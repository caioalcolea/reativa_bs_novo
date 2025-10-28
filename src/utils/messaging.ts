import { config } from '../config';
import { logger } from './logger';
import { database } from '../config/database';

/**
 * Verifica se o horário atual está dentro do período permitido para envio de mensagens
 * Permitido: 08:00 - 19:00 (nunca de madrugada)
 */
export function isAllowedMessagingTime(): boolean {
  const now = new Date();
  const hour = now.getHours();

  const startHour = config.messaging.allowedStartHour;
  const endHour = config.messaging.allowedEndHour;

  return hour >= startHour && hour < endHour;
}

/**
 * Aguarda até o próximo horário permitido para envio de mensagens
 * Retorna imediatamente se já estiver no horário permitido
 */
export async function waitForAllowedMessagingTime(): Promise<void> {
  if (isAllowedMessagingTime()) {
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const startHour = config.messaging.allowedStartHour;
  const endHour = config.messaging.allowedEndHour;

  // Se passou do horário permitido hoje, aguardar até amanhã
  if (currentHour >= endHour) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(startHour, 0, 0, 0);

    const waitMs = tomorrow.getTime() - now.getTime();
    logger.info(`Fora do horário permitido (${currentHour}h). Aguardando até ${tomorrow.toLocaleString('pt-BR')} para enviar mensagens`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  } else {
    // Ainda é cedo hoje, aguardar até startHour
    const today = new Date(now);
    today.setHours(startHour, 0, 0, 0);

    const waitMs = today.getTime() - now.getTime();
    logger.info(`Fora do horário permitido (${currentHour}h). Aguardando até ${today.toLocaleString('pt-BR')} para enviar mensagens`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

/**
 * Verifica se já foi enviada uma mensagem para este cliente hoje
 * Retorna true se JÁ foi enviado (duplicata), false se pode enviar
 */
export async function wasMessageSentToday(
  customerId: number,
  messageType: 'vaccine' | 'grooming' | 'appointment' | 'satisfaction'
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const result = await database.query(
      `SELECT COUNT(*) as count
       FROM reactivation_logs
       WHERE customer_id = $1
         AND reactivation_type = $2
         AND sent_at >= $3
         AND sent_at < $4`,
      [customerId, messageType, today, tomorrow]
    );

    const count = result[0]?.count || 0;
    return count > 0;
  } catch (error) {
    logger.error('Erro ao verificar duplicata de mensagem:', error);
    return false; // Em caso de erro, permitir envio (melhor enviar que não enviar)
  }
}

/**
 * Delay mínimo de 2 minutos entre mensagens (anti-spam)
 */
export async function applyMessagingDelay(): Promise<void> {
  const delayMs = config.messaging.minDelayBetweenMessages;

  if (delayMs > 0) {
    logger.debug(`Aguardando ${delayMs / 1000}s antes do próximo envio (anti-spam)`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

/**
 * Formata data para string legível em português
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata número de telefone para formato WhatsApp
 * Remove caracteres especiais e adiciona código do país se necessário
 */
export function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');

  // Se não tem código do país, adiciona 55 (Brasil)
  if (cleaned.length === 11 || cleaned.length === 10) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}
