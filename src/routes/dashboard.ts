import { Router, Request, Response } from 'express';
import { database } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Estatísticas gerais do dashboard
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Total de clientes
    const [{ count: total_customers }] = await database.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM customers'
    );

    // Total de pets
    const [{ count: total_pets }] = await database.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM pets'
    );

    // Mensagens enviadas hoje
    const [{ count: messages_today }] = await database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM reactivation_logs
       WHERE DATE(sent_at) = CURRENT_DATE`
    );

    // Mensagens enviadas esta semana
    const [{ count: messages_week }] = await database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM reactivation_logs
       WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'`
    );

    // Taxa de sucesso hoje
    const successToday = await database.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM reactivation_logs
       WHERE DATE(sent_at) = CURRENT_DATE
       GROUP BY status`
    );

    const successCount = successToday.find(r => r.status === 'success')?.count || '0';
    const errorCount = successToday.find(r => r.status === 'error')?.count || '0';
    const totalToday = parseInt(successCount) + parseInt(errorCount);
    const successRate = totalToday > 0 ? ((parseInt(successCount) / totalToday) * 100).toFixed(1) : '0';

    // Mensagens por tipo hoje
    const messagesByType = await database.query<{ module: string; count: string }>(
      `SELECT COALESCE(module, reactivation_type) as module, COUNT(*) as count
       FROM reactivation_logs
       WHERE DATE(sent_at) = CURRENT_DATE
       GROUP BY COALESCE(module, reactivation_type)
       ORDER BY count DESC`
    );

    // Próximas vacinas (próximos 30 dias)
    const [{ count: upcoming_vaccines }] = await database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM vaccines
       WHERE next_dose_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`
    );

    // Consultas agendadas (próximos 7 dias)
    const [{ count: upcoming_appointments }] = await database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM appointments
       WHERE appointment_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       AND status IN ('agendado', 'confirmado')`
    );

    // Pets por espécie
    const petsBySpecies = await database.query<{ species: string; count: string }>(
      `SELECT species, COUNT(*) as count FROM pets
       GROUP BY species
       ORDER BY count DESC
       LIMIT 5`
    );

    // Última sincronização
    const lastSync = await database.query<{ updated_at: Date }>(
      `SELECT updated_at FROM pets
       ORDER BY updated_at DESC
       LIMIT 1`
    );

    res.json({
      success: true,
      data: {
        customers: parseInt(total_customers),
        pets: parseInt(total_pets),
        appointments: parseInt(upcoming_appointments),
        messages: {
          today: parseInt(messages_today),
          week: parseInt(messages_week),
          successRate: parseFloat(successRate),
        },
        messagesByType: messagesByType.map(m => ({
          type: m.module,
          count: parseInt(m.count),
        })),
        upcoming: {
          vaccines: parseInt(upcoming_vaccines),
          appointments: parseInt(upcoming_appointments),
        },
        petsBySpecies: petsBySpecies.map(p => ({
          species: p.species,
          count: parseInt(p.count),
        })),
        lastSync: lastSync.length > 0 ? lastSync[0].updated_at : null,
      },
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas do dashboard:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * Mensagens recentes
 */
router.get('/recent-messages', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await database.query<{
      id: number;
      customer_id: number;
      pet_id: number;
      module: string;
      reactivation_type: string;
      message_sent: any;
      sent_at: Date;
      status: string;
      error_message: string | null;
      customer_name: string;
      customer_phone: string;
      pet_name: string;
    }>(
      `SELECT
        rl.id,
        rl.customer_id,
        rl.pet_id,
        COALESCE(rl.module, rl.reactivation_type) as module,
        rl.reactivation_type,
        rl.message_sent,
        rl.sent_at,
        rl.status,
        rl.error_message,
        c.name as customer_name,
        c.phone as customer_phone,
        p.name as pet_name
      FROM reactivation_logs rl
      INNER JOIN customers c ON rl.customer_id = c.id
      LEFT JOIN pets p ON rl.pet_id = p.id
      ORDER BY rl.sent_at DESC
      LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: messages.map(m => ({
        id: m.id,
        type: m.module,
        customer: {
          name: m.customer_name,
          phone: m.customer_phone,
        },
        pet: m.pet_name ? { name: m.pet_name } : null,
        sentAt: m.sent_at,
        status: m.status,
        error: m.error_message,
      })),
    });
  } catch (error) {
    logger.error('Erro ao buscar mensagens recentes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar mensagens' });
  }
});

/**
 * Estatísticas por período (últimos 7 dias)
 */
router.get('/stats-by-day', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await database.query<{
      date: string;
      type: string;
      count: string;
      success: string;
    }>(
      `SELECT
        DATE(sent_at) as date,
        reactivation_type as type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
      FROM reactivation_logs
      WHERE sent_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(sent_at), reactivation_type
      ORDER BY date DESC, type`
    );

    res.json({
      success: true,
      data: stats.map(s => ({
        date: s.date,
        type: s.type,
        count: parseInt(s.count),
        success: parseInt(s.success),
        errorRate: ((parseInt(s.count) - parseInt(s.success)) / parseInt(s.count) * 100).toFixed(1),
      })),
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas por dia:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

/**
 * Top clientes com mais reativações
 */
router.get('/top-customers', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const topCustomers = await database.query<{
      customer_id: number;
      customer_name: string;
      customer_phone: string;
      total_messages: string;
      last_message: Date;
    }>(
      `SELECT
        rl.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        COUNT(*) as total_messages,
        MAX(rl.sent_at) as last_message
      FROM reactivation_logs rl
      INNER JOIN customers c ON rl.customer_id = c.id
      GROUP BY rl.customer_id, c.name, c.phone
      ORDER BY total_messages DESC
      LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: topCustomers.map(c => ({
        customerId: c.customer_id,
        name: c.customer_name,
        phone: c.customer_phone,
        totalMessages: parseInt(c.total_messages),
        lastMessage: c.last_message,
      })),
    });
  } catch (error) {
    logger.error('Erro ao buscar top clientes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar top clientes' });
  }
});

/**
 * Executar job manualmente (reuso do endpoint existente)
 */
router.post('/run-job/:jobName', async (req: Request, res: Response) => {
  const { jobName } = req.params;

  try {
    // Importar scheduler para executar job
    const { scheduler } = await import('../services/scheduler');
    await scheduler.runJobManually(jobName);

    res.json({
      success: true,
      message: `Job ${jobName} executado com sucesso`,
    });
  } catch (error: any) {
    logger.error(`Erro ao executar job ${jobName}:`, error);
    res.status(500).json({
      success: false,
      message: `Erro ao executar job ${jobName}`,
      error: error.message,
    });
  }
});

export default router;
