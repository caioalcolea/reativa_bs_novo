# 🏗️ Arquitetura do Sistema

Documentação completa da arquitetura do Sistema de Reativação Automática da Clínica Bicho Solto.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura de Alto Nível](#arquitetura-de-alto-nível)
- [Camadas da Aplicação](#camadas-da-aplicação)
- [Fluxo de Dados](#fluxo-de-dados)
- [Banco de Dados](#banco-de-dados)
- [APIs Externas](#apis-externas)
- [Módulos](#módulos)
- [Cron Jobs](#cron-jobs)
- [Segurança](#segurança)
- [Escalabilidade](#escalabilidade)

## 🎯 Visão Geral

O sistema é uma aplicação Node.js/TypeScript que automatiza a comunicação com clientes de clínicas veterinárias via WhatsApp, integrando dados do VetCare (sistema de gestão veterinária) e enviando mensagens através da Evolution API.

### Características Principais

- **Microserviços**: Arquitetura modular com serviços independentes
- **Assíncrono**: Processamento via cron jobs agendados
- **Escalável**: Docker Swarm ready
- **Observável**: Logs estruturados e health checks
- **Resiliente**: Retry logic e error handling

## 📐 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└──────────────┬──────────────────┬──────────────────────────┘
               │                  │
               │                  │
      ┌────────▼────────┐ ┌──────▼───────┐
      │  VetCare API    │ │Evolution API │
      │ (vet.talkhub.me)│ │  (WhatsApp)  │
      └────────┬────────┘ └──────┬───────┘
               │                  │
               │ HTTPS            │ HTTPS
               │                  │
      ┌────────▼──────────────────▼────────┐
      │         Docker Swarm                │
      │  ┌──────────────────────────────┐  │
      │  │   Traefik (Reverse Proxy)    │  │
      │  └──────────────┬───────────────┘  │
      │                 │                   │
      │  ┌──────────────▼───────────────┐  │
      │  │  Bot Service (Node.js)       │  │
      │  │  ┌────────────────────────┐  │  │
      │  │  │  Express Web Server    │  │  │
      │  │  │  - Dashboard           │  │  │
      │  │  │  - Health Check        │  │  │
      │  │  │  - API Routes          │  │  │
      │  │  └────────────────────────┘  │  │
      │  │  ┌────────────────────────┐  │  │
      │  │  │  Cron Jobs             │  │  │
      │  │  │  - VetCare Sync        │  │  │
      │  │  │  - Vaccines            │  │  │
      │  │  │  - Grooming            │  │  │
      │  │  │  - Appointments        │  │  │
      │  │  │  - Satisfaction        │  │  │
      │  │  └────────────────────────┘  │  │
      │  └──────────────┬───────────────┘  │
      │                 │                   │
      │  ┌──────────────▼───────────────┐  │
      │  │  PostgreSQL Database         │  │
      │  │  - Customers                 │  │
      │  │  - Pets                      │  │
      │  │  - Vaccines                  │  │
      │  │  - Appointments              │  │
      │  │  - Grooming Services         │  │
      │  │  - Reactivation Logs         │  │
      │  └──────────────────────────────┘  │
      └─────────────────────────────────────┘
               │
               │
      ┌────────▼────────┐
      │ Administrator   │
      │   Dashboard     │
      └─────────────────┘
```

## 🧱 Camadas da Aplicação

### 1. Camada de Apresentação (Presentation Layer)

**Responsabilidade**: Interface com usuários e sistemas externos

```
src/public/dashboard.html    # Dashboard UI (Spotify-style)
src/routes/dashboard.ts       # API do dashboard
src/routes/health.ts          # Health check endpoint
```

**Tecnologias**:
- Express.js para rotas HTTP
- HTML + CSS + Vanilla JS para UI
- Chart.js para visualizações
- Tailwind CSS para styling

### 2. Camada de Aplicação (Application Layer)

**Responsabilidade**: Lógica de negócio e orquestração

```
src/modules/
├── vaccines/             # Reativação de vacinas
│   └── vaccineReactivation.ts
├── grooming/             # Reativação banho/tosa
│   └── groomingReactivation.ts
├── appointments/         # Confirmação consultas
│   └── appointmentConfirmation.ts
└── satisfaction/         # Pesquisa satisfação
    └── satisfactionSurvey.ts
```

**Padrões**:
- Service Layer Pattern
- Repository Pattern
- Factory Pattern para mensagens

### 3. Camada de Serviços (Service Layer)

**Responsabilidade**: Integração com sistemas externos

```
src/services/
├── vetcareApiService.ts   # Integração VetCare
├── whatsappService.ts     # Integração Evolution API
└── schedulerService.ts    # Agendamento de jobs
```

**Características**:
- Retry logic automático
- Circuit breaker para APIs
- Cache de respostas (quando aplicável)
- Rate limiting

### 4. Camada de Dados (Data Layer)

**Responsabilidade**: Persistência e acesso a dados

```
src/config/database.ts     # Pool de conexões PostgreSQL
```

**Padrões**:
- Connection pooling
- Prepared statements (SQL injection protection)
- Transações para operações críticas

### 5. Camada de Utilitários (Utility Layer)

**Responsabilidade**: Funções auxiliares

```
src/utils/
├── logger.ts              # Sistema de logs
├── dateHelpers.ts         # Helpers de data
├── messaging.ts           # Controles de mensagens
└── validators.ts          # Validações
```

## 🔄 Fluxo de Dados

### Fluxo de Sincronização VetCare

```
1. Cron Trigger (04:00)
   │
   ▼
2. vetcareApiService.syncAll()
   │
   ├──▶ syncCustomers()
   │    │
   │    ├─▶ GET /clientes (paginado)
   │    │   └─▶ Detecção de duplicatas
   │    │
   │    └─▶ UPSERT customers
   │        └─▶ INSERT ... ON CONFLICT DO UPDATE
   │
   ├──▶ syncPets()
   │    │
   │    ├─▶ GET /pets (até 10k, paginado)
   │    │   └─▶ Detecção de duplicatas (>90% = stop)
   │    │
   │    └─▶ UPSERT pets
   │        └─▶ Validação FK (customer_id exists)
   │
   ├──▶ syncVaccines()
   │    │
   │    ├─▶ GET /vacinacoes (paginado)
   │    │
   │    └─▶ UPSERT vaccines
   │        └─▶ Validação FK (pet_id exists)
   │
   ├──▶ syncAppointments()
   │    │
   │    ├─▶ GET /agendamentos?data_inicio=2022-01-01&data_fim=2026-12-31
   │    │   └─▶ Filtro de datas (finite result set)
   │    │
   │    └─▶ UPSERT appointments
   │        └─▶ Validação FK (pet_id exists)
   │
   └──▶ syncGroomingServices()
        │
        ├─▶ GET /banhos (paginado)
        │
        └─▶ UPSERT grooming_services
            └─▶ Validação FK (pet_id exists)
```

### Fluxo de Reativação de Vacinas

```
1. Cron Trigger (09:30)
   │
   ▼
2. isAllowedMessagingTime()
   │ (08:00-19:00?)
   │
   ├─ NO ──▶ Abort (log warning)
   │
   └─ YES
      │
      ▼
3. getVaccinesForReactivation()
   │
   ├─▶ Query vaccines WHERE
   │   - next_dose_date <= NOW() + 30 days
   │   - OR last_dose_date < NOW() - 365 days
   │   - AND customer.phone IS NOT NULL
   │
   └─▶ vaccinesArray[]
       │
       ▼
4. Para cada vaccine:
   │
   ├─▶ wasMessageSentToday(customer_id, pet_id, 'vaccine')
   │   │
   │   ├─ YES ──▶ Skip (skippedCount++)
   │   │
   │   └─ NO
   │       │
   │       ▼
   │   isValidPhoneNumber(phone)
   │   │
   │   ├─ NO ──▶ Log error (errorCount++)
   │   │
   │   └─ YES
   │       │
   │       ▼
   │   generateVaccineMessage(vaccine)
   │   │
   │   └─▶ "📢 *Lembrete de Vacinação...*"
   │       │
   │       ▼
   │   whatsappService.sendMessage(phone, message)
   │   │
   │   ├─▶ POST /message/sendText (Evolution API)
   │   │   │
   │   │   ├─ Success ──▶ logReactivation('success')
   │   │   │             └─▶ successCount++
   │   │   │
   │   │   └─ Error ───▶ logReactivation('error', reason)
   │   │                 └─▶ errorCount++
   │   │
   │   └─▶ applyMessagingDelay()
   │       └─▶ sleep(120000ms) // 2 minutes
   │
   ▼
5. Log final
   └─▶ "Reativação concluída: X sucessos, Y erros, Z pulados"
```

### Fluxo do Dashboard

```
Browser
   │
   │ GET /dashboard
   ▼
dashboard.html loaded
   │
   ├─▶ loadStats()
   │   │
   │   └─▶ GET /api/dashboard/stats
   │       │
   │       ├─▶ Query: COUNT(*) FROM customers
   │       ├─▶ Query: COUNT(*) FROM pets
   │       ├─▶ Query: messages today + success rate
   │       └─▶ Query: upcoming appointments
   │           │
   │           └─▶ return JSON
   │               └─▶ Update UI
   │
   ├─▶ loadRecentMessages()
   │   │
   │   └─▶ GET /api/dashboard/recent-messages?limit=15
   │       │
   │       └─▶ Query: SELECT * FROM reactivation_logs
   │           ORDER BY sent_at DESC LIMIT 15
   │           │
   │           └─▶ return JSON
   │               └─▶ Render table
   │
   └─▶ loadStatsByDay()
       │
       └─▶ GET /api/dashboard/stats-by-day?days=7
           │
           └─▶ Query: messages grouped by DATE(sent_at)
               │
               └─▶ return JSON
                   └─▶ Render charts

Auto-refresh every 30s
   │
   └─▶ setInterval(loadAll, 30000)
```

## 🗄️ Banco de Dados

### Schema PostgreSQL

```sql
┌─────────────┐       ┌─────────────┐
│  customers  │       │    pets     │
├─────────────┤       ├─────────────┤
│ id (PK)     │◀──┐   │ id (PK)     │
│ name        │   │   │ name        │
│ email       │   │   │ species     │
│ phone       │   │   │ breed       │
│ cpf         │   │   │ birthdate   │
│ created_at  │   │   │ customer_id │
│ updated_at  │   │   │ (FK) ───────┘
└─────────────┘   │   └─────────────┘
                  │          │
                  │          │
    ┌─────────────┼──────────┼─────────────┬──────────────┐
    │             │          │             │              │
    ▼             ▼          ▼             ▼              ▼
┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌─────────────┐
│ vaccines │ │appoint-  │ │grooming_│ │satisfaction│ │reactivation_│
│          │ │ments     │ │services │ │  _surveys  │ │    logs     │
├──────────┤ ├──────────┤ ├─────────┤ ├───────────┤ ├─────────────┤
│ id (PK)  │ │ id (PK)  │ │ id (PK) │ │ id (PK)   │ │ id (PK)     │
│ pet_id   │ │ pet_id   │ │ pet_id  │ │ customer  │ │ customer_id │
│ (FK)     │ │ (FK)     │ │ (FK)    │ │ _id (FK)  │ │ (FK)        │
│ vaccine  │ │ date     │ │ date    │ │ pet_id    │ │ pet_id (FK) │
│ _name    │ │ type     │ │ type    │ │ (FK)      │ │ module      │
│ last_dose│ │ status   │ │ has_plan│ │ rating    │ │ status      │
│ next_dose│ │ ...      │ │ ...     │ │ ...       │ │ message     │
│ ...      │ └──────────┘ └─────────┘ └───────────┘ │ sent_at     │
└──────────┘                                         │ ...         │
                                                     └─────────────┘
```

### Principais Queries

**1. Buscar Vacinas para Reativação**
```sql
SELECT
  v.id, v.pet_id, v.vaccine_name, v.next_dose_date,
  p.name as pet_name, c.name as customer_name, c.phone
FROM vaccines v
INNER JOIN pets p ON v.pet_id = p.id
INNER JOIN customers c ON p.customer_id = c.id
WHERE c.phone IS NOT NULL
  AND (
    v.next_dose_date <= NOW() + INTERVAL '30 days'
    OR v.last_dose_date < NOW() - INTERVAL '365 days'
  )
ORDER BY v.next_dose_date ASC;
```

**2. Verificar se Mensagem Foi Enviada Hoje**
```sql
SELECT COUNT(*) as count
FROM reactivation_logs
WHERE customer_id = $1
  AND pet_id = $2
  AND module = $3
  AND DATE(sent_at) = CURRENT_DATE;
```

**3. Stats do Dashboard**
```sql
SELECT
  (SELECT COUNT(*) FROM customers) as total_customers,
  (SELECT COUNT(*) FROM pets) as total_pets,
  (SELECT COUNT(*) FROM reactivation_logs WHERE DATE(sent_at) = CURRENT_DATE) as messages_today,
  (SELECT COUNT(*) FROM reactivation_logs WHERE DATE(sent_at) = CURRENT_DATE AND status = 'success') as messages_success;
```

### Índices

```sql
-- Performance queries
CREATE INDEX idx_vaccines_next_dose ON vaccines(next_dose_date);
CREATE INDEX idx_pets_customer_id ON pets(customer_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_logs_sent_at ON reactivation_logs(sent_at);
CREATE INDEX idx_logs_customer_pet ON reactivation_logs(customer_id, pet_id);
```

## 🔌 APIs Externas

### VetCare API

**Base URL**: `https://vet.talkhub.me/api`

**Endpoints Utilizados**:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/clientes` | GET | Lista clientes (paginado) |
| `/pets` | GET | Lista pets (paginado) |
| `/vacinacoes` | GET | Lista vacinas (paginado) |
| `/agendamentos` | GET | Lista agendamentos (paginado) |
| `/banhos` | GET | Lista banhos/tosa (paginado) |

**Headers**:
```javascript
{
  'Authorization': `Bearer ${VETCARE_API_KEY}`,
  'Content-Type': 'application/json'
}
```

**Paginação**:
```
GET /pets?page=1
GET /pets?page=2
...
```

**Rate Limiting**:
- 150-200ms delay entre requests
- Detecção de duplicatas (>90% = stop)

### Evolution API (WhatsApp)

**Base URL**: `https://evolution.talkhub.me`

**Endpoints Utilizados**:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/message/sendText/{instance}` | POST | Envia mensagem texto |
| `/instance/connect/{instance}` | GET | Verifica conexão |

**Headers**:
```javascript
{
  'apikey': `${EVOLUTION_API_KEY}`,
  'Content-Type': 'application/json'
}
```

**Payload (sendText)**:
```javascript
{
  "number": "5519999999999",  // +55 + DDD + número
  "text": "Mensagem aqui"
}
```

**Validação de Telefone**:
```typescript
function isValidPhoneNumber(phone: string): boolean {
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');

  // Deve ter 12-13 dígitos (55 + DDD + número)
  return /^55\d{10,11}$/.test(cleaned);
}
```

## 📦 Módulos

### 1. Vaccines Module

**Arquivo**: `src/modules/vaccines/vaccineReactivation.ts`

**Responsabilidade**:
- Identificar vacinas vencidas ou próximas do vencimento
- Gerar mensagens personalizadas
- Enviar lembretes via WhatsApp
- Registrar logs

**Regras de Negócio**:
- Vacina próxima do vencimento: `next_dose_date <= NOW() + 30 days`
- Vacina atrasada: `last_dose_date < NOW() - 365 days`
- Apenas 1 mensagem por dia por pet

**Métodos Principais**:
- `getVaccinesForReactivation()`: Busca vacinas
- `generateReactivationMessage()`: Cria mensagem
- `processVaccineReactivations()`: Processa fila

### 2. Grooming Module

**Arquivo**: `src/modules/grooming/groomingReactivation.ts`

**Responsabilidade**:
- Reativar clientes para banho/tosa
- Sugerir planos mensais
- Enviar ofertas personalizadas

**Regras de Negócio**:
- Cliente com plano: último banho > 30 dias
- Cliente sem plano: último banho > 60 dias
- Mensagem diferente para quem tem/não tem plano

**Métodos Principais**:
- `getGroomingServicesForReactivation()`: Busca serviços
- `generatePlanReminderMessage()`: Mensagem para plano mensal
- `generateNoPlanMessage()`: Mensagem com oferta de planos
- `getBreedSpecificPlans()`: Busca planos para raça

### 3. Appointments Module

**Arquivo**: `src/modules/appointments/appointmentConfirmation.ts`

**Responsabilidade**:
- Confirmar consultas 1 dia antes
- Enviar detalhes (data, hora, tipo)
- Permitir remarcação

**Regras de Negócio**:
- Apenas consultas agendadas para amanhã
- Não enviar para retornos (já confirmados)
- Status deve ser 'agendado'

**Métodos Principais**:
- `getAppointmentsForConfirmation()`: Busca consultas de amanhã
- `generateConfirmationMessage()`: Cria mensagem
- `hasFutureAppointments()`: Verifica se já tem consulta futura
- `updateAppointmentStatus()`: Atualiza status para 'confirmado'

### 4. Satisfaction Module

**Arquivo**: `src/modules/satisfaction/satisfactionSurvey.ts`

**Responsabilidade**:
- Enviar pesquisa pós-atendimento
- Coletar feedback
- Integrar com Google Reviews

**Regras de Negócio**:
- Enviar 24h após atendimento
- Apenas atendimentos concluídos
- Link para avaliação no Google

**Métodos Principais**:
- `getCompletedAppointments()`: Busca atendimentos concluídos
- `generateSurveyMessage()`: Cria pesquisa
- `getGoogleReviewLink()`: Gera link de avaliação

## ⏰ Cron Jobs

### Configuração

```typescript
// src/config/index.ts
export const config = {
  cron: {
    vetcareSync: process.env.CRON_VETCARE_SYNC || '0 4 * * *',
    vaccines: process.env.CRON_VACCINES || '30 9 * * *',
    grooming: process.env.CRON_GROOMING || '0 11 * * *',
    appointments: process.env.CRON_APPOINTMENTS || '0 8 * * *',
    satisfaction: process.env.CRON_SATISFACTION || '0 18 * * *',
  },
};
```

### Schedule Definido

| Job | Cron | Horário | Descrição |
|-----|------|---------|-----------|
| VetCare Sync | `0 4 * * *` | 04:00 | Sincroniza dados do VetCare |
| Vacinas | `30 9 * * *` | 09:30 | Envia lembretes de vacinas |
| Banho/Tosa | `0 11 * * *` | 11:00 | Reativa clientes para banho |
| Consultas | `0 8 * * *` | 08:00 | Confirma consultas de amanhã |
| Satisfação | `0 18 * * *` | 18:00 | Envia pesquisa pós-atendimento |

### Implementação

```typescript
import cron from 'node-cron';

// VetCare Sync - 04:00
cron.schedule(config.cron.vetcareSync, async () => {
  logger.info('Iniciando sync VetCare (agendado)');
  try {
    await vetcareApiService.syncAll();
    logger.info('Sync VetCare concluído com sucesso');
  } catch (error) {
    logger.error('Erro no sync VetCare:', error);
  }
});

// Vacinas - 09:30
cron.schedule(config.cron.vaccines, async () => {
  logger.info('Iniciando reativação de vacinas (agendado)');
  try {
    await vaccineReactivation.processVaccineReactivations();
    logger.info('Reativação de vacinas concluída');
  } catch (error) {
    logger.error('Erro na reativação de vacinas:', error);
  }
});

// ... outros jobs
```

## 🔒 Segurança

### Autenticação

- API keys em variáveis de ambiente (`.env`)
- Nunca commitar secrets no Git
- Rotação de keys recomendada (90 dias)

### Validação de Dados

```typescript
// Validação de telefone
function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^55\d{10,11}$/.test(cleaned);
}

// Sanitização SQL (prepared statements)
const result = await database.query(
  'SELECT * FROM customers WHERE id = $1',
  [customerId]  // Parâmetro seguro
);
```

### Proteção contra SQL Injection

- **Prepared Statements**: Sempre usar `$1`, `$2`, etc.
- **ORM**: Considerar TypeORM ou Prisma (futuro)
- **Input Validation**: Validar todos os inputs

### Rate Limiting

```typescript
// Delay entre requests
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms

// Delay entre mensagens
await applyMessagingDelay(); // 2 minutos
```

### CORS

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  credentials: true,
}));
```

## 📈 Escalabilidade

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  bot:
    deploy:
      replicas: 3  # 3 instâncias
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

### Database Connection Pool

```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,  // Máximo 20 conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching (Futuro)

```typescript
// Redis para cache
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});

// Cache de stats
async function getStats() {
  const cached = await redis.get('dashboard:stats');
  if (cached) return JSON.parse(cached);

  const stats = await fetchStatsFromDB();
  await redis.setex('dashboard:stats', 60, JSON.stringify(stats)); // 60s TTL
  return stats;
}
```

### Message Queue (Futuro)

```typescript
// RabbitMQ para fila de mensagens
import amqp from 'amqplib';

// Producer
async function queueMessage(message: Message) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue('whatsapp_messages');
  channel.sendToQueue('whatsapp_messages', Buffer.from(JSON.stringify(message)));
}

// Consumer
async function processQueue() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  await channel.assertQueue('whatsapp_messages');
  channel.consume('whatsapp_messages', async (msg) => {
    if (msg) {
      const message = JSON.parse(msg.content.toString());
      await whatsappService.sendMessage(message.phone, message.text);
      channel.ack(msg);
    }
  });
}
```

## 📊 Observabilidade

### Logging

```typescript
// Winston logger
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
```

### Métricas

```typescript
// Prometheus metrics (futuro)
import prometheus from 'prom-client';

const register = new prometheus.Registry();

const messagesSent = new prometheus.Counter({
  name: 'messages_sent_total',
  help: 'Total de mensagens enviadas',
  labelNames: ['module', 'status'],
});

register.registerMetric(messagesSent);

// Incrementar métrica
messagesSent.inc({ module: 'vaccines', status: 'success' });
```

### Health Check

```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'unknown',
    services: {
      vetcare: 'unknown',
      whatsapp: 'unknown',
    },
  };

  // Verificar database
  try {
    await database.query('SELECT 1');
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'unhealthy';
  }

  // Verificar VetCare API
  try {
    await axios.get(`${config.vetcare.apiUrl}/health`);
    health.services.vetcare = 'available';
  } catch {
    health.services.vetcare = 'unavailable';
  }

  // Verificar WhatsApp API
  try {
    await axios.get(`${config.evolution.apiUrl}/instance/connectionState/${config.evolution.instanceName}`);
    health.services.whatsapp = 'available';
  } catch {
    health.services.whatsapp = 'unavailable';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

**Arquitetura projetada para produção!** 🏗️

*Última atualização: Outubro 2025*
