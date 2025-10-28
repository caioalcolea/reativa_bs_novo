import { database } from '../../config/database';
import { whatsappService } from '../../services/whatsappService';
import { logger } from '../../utils/logger';
import { dateHelpers } from '../../utils/dateHelpers';
import { isAllowedMessagingTime, waitForAllowedMessagingTime, applyMessagingDelay, wasMessageSentToday } from '../../utils/messaging';
import { Vaccine, ReactivationLog } from '../../types';

export class VaccineReactivation {
  /**
   * Busca vacinas que precisam de reativação
   */
  async getVaccinesForReactivation(): Promise<Vaccine[]> {
    const query = `
      SELECT
        v.id,
        v.pet_id,
        v.vaccine_name,
        v.application_date,
        v.next_dose_date,
        v.is_annual,
        p.name as pet_name,
        c.name as customer_name,
        c.phone as customer_phone
      FROM vaccines v
      INNER JOIN pets p ON v.pet_id = p.id
      INNER JOIN customers c ON p.customer_id = c.id
      WHERE c.phone IS NOT NULL
        AND c.phone != ''
      ORDER BY v.application_date DESC
    `;

    try {
      const vaccines = await database.query<Vaccine>(query);

      // Filtrar vacinas que precisam de reativação
      const vaccinesToReactivate = vaccines.filter((vaccine) => {
        const { shouldReactivate } = dateHelpers.shouldReactivateVaccine(
          vaccine.next_dose_date || null,
          new Date(vaccine.application_date),
          vaccine.is_annual
        );
        return shouldReactivate;
      });

      logger.info(`Encontradas ${vaccinesToReactivate.length} vacinas para reativação`);
      return vaccinesToReactivate;
    } catch (error) {
      logger.error('Erro ao buscar vacinas para reativação:', error);
      return [];
    }
  }

  /**
   * Verifica se já foi enviada reativação para esta vacina hoje
   */
  async wasReactivationSentToday(customerId: number, vaccineId: number): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM reactivation_logs
      WHERE customer_id = $1
        AND reactivation_type = 'vaccine'
        AND (message_sent->>'vaccineId')::INTEGER = $2
        AND DATE(sent_at) = CURRENT_DATE
    `;

    try {
      const result = await database.query<{ count: number }>(query, [customerId, vaccineId]);
      return result[0].count > 0;
    } catch (error) {
      logger.error('Erro ao verificar reativação enviada:', error);
      return false;
    }
  }

  /**
   * Gera mensagem de reativação de vacina
   */
  generateReactivationMessage(vaccine: Vaccine): string {
    // Mensagem personalizada conforme solicitado
    let message = `📢 *Lembrete de Vacinação – Clínica Bicho Solto* 🐾\n\n`;
    message += `Olá, *${vaccine.customer_name}*! Tudo bem? 😊\n`;
    message += `Está na hora da vacinação do(a) *${vaccine.pet_name}* 💉\n\n`;
    message += `Manter as vacinas em dia é essencial para garantir a saúde e o bem-estar dele(a)! 🐶🐱\n\n`;
    message += `Podemos agendar o horário e manter a proteção dele(a) em dia?\n\n`;
    message += `Cuidar de quem a gente ama é o melhor investimento! ❤️`;

    return message;
  }

  /**
   * Registra log de reativação enviada
   */
  async logReactivation(
    customerId: number,
    vaccineId: number,
    petId: number,
    message: string,
    status: 'success' | 'error',
    errorMessage?: string
  ): Promise<void> {
    const query = `
      INSERT INTO reactivation_logs
        (customer_id, pet_id, module, reactivation_type, message_sent, sent_at, status, error_message)
      VALUES ($1, $2, 'vaccine', 'vaccine', $3, NOW(), $4, $5)
    `;

    const messageData = JSON.stringify({
      vaccineId,
      message,
    });

    try {
      await database.query(query, [customerId, petId, messageData, status, errorMessage || null]);
    } catch (error) {
      logger.error('Erro ao registrar log de reativação:', error);
    }
  }

  /**
   * Processa reativação de vacinas
   * IMPORTANTE: Apenas envia entre 08:00 e 19:00, nunca de madrugada
   */
  async processVaccineReactivations(): Promise<void> {
    logger.info('Iniciando processamento de reativação de vacinas');

    // Verificar se está no horário permitido (08:00 - 19:00)
    if (!isAllowedMessagingTime()) {
      logger.warn('Fora do horário permitido para envio de mensagens (08:00-19:00). Processo abortado.');
      return;
    }

    try {
      const vaccines = await this.getVaccinesForReactivation();

      if (vaccines.length === 0) {
        logger.info('Nenhuma vacina para reativar hoje');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const vaccine of vaccines) {
        try {
          // Verificar novamente se ainda está no horário permitido
          if (!isAllowedMessagingTime()) {
            logger.warn(`Atingido horário limite (19:00). Parando envios. Faltam ${vaccines.length - successCount - errorCount - skippedCount} mensagens.`);
            break;
          }

          // Buscar customer_id do pet
          const petQuery = `SELECT customer_id FROM pets WHERE id = $1`;
          const petResult = await database.query<{ customer_id: number }>(petQuery, [vaccine.pet_id]);

          if (petResult.length === 0) {
            logger.warn(`Pet não encontrado: ${vaccine.pet_id}`);
            continue;
          }

          const customerId = petResult[0].customer_id;

          // Verificar se já foi enviado hoje (anti-spam: máximo 1 por dia)
          const alreadySent = await wasMessageSentToday(customerId, vaccine.pet_id, 'vaccine');
          if (alreadySent) {
            logger.info(`Mensagem de vacinação já enviada hoje para ${vaccine.customer_name} - Pet: ${vaccine.pet_name}`);
            skippedCount++;
            continue;
          }

          // Validar telefone
          if (!vaccine.customer_phone || !whatsappService.isValidPhoneNumber(vaccine.customer_phone)) {
            logger.warn(`Telefone inválido para cliente: ${vaccine.customer_name}`);
            await this.logReactivation(
              customerId,
              vaccine.id,
              vaccine.pet_id,
              '',
              'error',
              'Telefone inválido'
            );
            errorCount++;
            continue;
          }

          // Gerar e enviar mensagem
          const message = this.generateReactivationMessage(vaccine);
          const sent = await whatsappService.sendMessage(vaccine.customer_phone, message);

          if (sent) {
            await this.logReactivation(customerId, vaccine.id, vaccine.pet_id, message, 'success');
            successCount++;
            logger.info(`Reativação enviada com sucesso para ${vaccine.customer_name} - Pet: ${vaccine.pet_name}`);
          } else {
            await this.logReactivation(
              customerId,
              vaccine.id,
              vaccine.pet_id,
              message,
              'error',
              'Falha ao enviar mensagem'
            );
            errorCount++;
          }

          // Aguardar 2 minutos entre cada envio (anti-spam)
          await applyMessagingDelay();

        } catch (error: any) {
          logger.error(`Erro ao processar reativação de vacina ${vaccine.id}:`, error);
          errorCount++;
        }
      }

      logger.info(`Reativação de vacinas concluída: ${successCount} sucessos, ${errorCount} erros, ${skippedCount} já enviados hoje`);
    } catch (error) {
      logger.error('Erro ao processar reativações de vacinas:', error);
    }
  }
}

export const vaccineReactivation = new VaccineReactivation();
