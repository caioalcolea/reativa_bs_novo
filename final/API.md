# 📡 API Documentation

Documentação completa das APIs e endpoints do Sistema de Reativação Automática.

## 📋 Índice

- [Base URL](#base-url)
- [Autenticação](#autenticação)
- [Dashboard API](#dashboard-api)
- [Health Check](#health-check)
- [Jobs API](#jobs-api)
- [Códigos de Status](#códigos-de-status)
- [Exemplos de Uso](#exemplos-de-uso)

## 🌐 Base URL

```
Desenvolvimento: http://localhost:3000
Produção: https://seu-dominio.com.br
```

## 🔐 Autenticação

Atualmente, as APIs não requerem autenticação. **Recomenda-se implementar autenticação para produção.**

### Futuro: Bearer Token

```http
Authorization: Bearer {token}
```

## 📊 Dashboard API

### GET /api/dashboard/stats

Retorna estatísticas gerais do sistema.

**Response 200 OK**

```json
{
  "success": true,
  "data": {
    "messages": {
      "today": 145,
      "successRate": 94
    },
    "customers": 5535,
    "pets": 5096,
    "appointments": 23,
    "messagesByType": [
      {
        "type": "vaccine",
        "count": 87
      },
      {
        "type": "grooming",
        "count": 32
      },
      {
        "type": "appointment",
        "count": 19
      },
      {
        "type": "satisfaction",
        "count": 7
      }
    ],
    "petsBySpecies": [
      {
        "species": "Cão",
        "count": 3245
      },
      {
        "species": "Gato",
        "count": 1851
      }
    ],
    "lastSync": "2025-10-28T04:15:32.000Z"
  }
}
```

**Campos**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `messages.today` | number | Total de mensagens enviadas hoje |
| `messages.successRate` | number | Taxa de sucesso (0-100) |
| `customers` | number | Total de clientes cadastrados |
| `pets` | number | Total de pets cadastrados |
| `appointments` | number | Consultas nos próximos 7 dias |
| `messagesByType` | array | Mensagens agrupadas por tipo |
| `petsBySpecies` | array | Pets agrupados por espécie |
| `lastSync` | string (ISO 8601) | Data/hora da última sincronização |

**Exemplo cURL**:

```bash
curl -X GET http://localhost:3000/api/dashboard/stats
```

**Exemplo JavaScript**:

```javascript
const response = await fetch('http://localhost:3000/api/dashboard/stats');
const { data } = await response.json();

console.log(`Mensagens hoje: ${data.messages.today}`);
console.log(`Taxa de sucesso: ${data.messages.successRate}%`);
```

---

### GET /api/dashboard/recent-messages

Retorna mensagens recentes enviadas.

**Query Parameters**:

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `limit` | number | Não | 10 | Número de mensagens a retornar (máx: 100) |

**Response 200 OK**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1234,
      "customer": {
        "id": 567,
        "name": "João Silva"
      },
      "pet": {
        "id": 890,
        "name": "Rex"
      },
      "type": "vaccine",
      "status": "success",
      "sentAt": "2025-10-28T09:35:12.000Z"
    },
    {
      "id": 1233,
      "customer": {
        "id": 568,
        "name": "Maria Santos"
      },
      "pet": {
        "id": 891,
        "name": "Luna"
      },
      "type": "grooming",
      "status": "success",
      "sentAt": "2025-10-28T11:02:45.000Z"
    }
  ]
}
```

**Campos**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID do log |
| `customer` | object | Dados do cliente |
| `pet` | object | Dados do pet (pode ser null) |
| `type` | string | Tipo: vaccine, grooming, appointment, satisfaction |
| `status` | string | Status: success, error |
| `sentAt` | string (ISO 8601) | Data/hora do envio |

**Exemplo cURL**:

```bash
curl -X GET "http://localhost:3000/api/dashboard/recent-messages?limit=15"
```

**Exemplo JavaScript**:

```javascript
const limit = 15;
const response = await fetch(`http://localhost:3000/api/dashboard/recent-messages?limit=${limit}`);
const { data } = await response.json();

data.forEach(msg => {
  console.log(`${msg.customer.name} - ${msg.pet.name} - ${msg.type} - ${msg.status}`);
});
```

---

### GET /api/dashboard/stats-by-day

Retorna estatísticas de mensagens agrupadas por dia.

**Query Parameters**:

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `days` | number | Não | 7 | Número de dias (máx: 30) |

**Response 200 OK**:

```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-28",
      "type": "vaccine",
      "count": 45,
      "success": 42
    },
    {
      "date": "2025-10-28",
      "type": "grooming",
      "count": 23,
      "success": 21
    },
    {
      "date": "2025-10-27",
      "type": "vaccine",
      "count": 38,
      "success": 36
    }
  ]
}
```

**Campos**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `date` | string (YYYY-MM-DD) | Data |
| `type` | string | Tipo de mensagem |
| `count` | number | Total de mensagens |
| `success` | number | Mensagens com sucesso |

**Exemplo cURL**:

```bash
curl -X GET "http://localhost:3000/api/dashboard/stats-by-day?days=7"
```

**Exemplo JavaScript**:

```javascript
const days = 7;
const response = await fetch(`http://localhost:3000/api/dashboard/stats-by-day?days=${days}`);
const { data } = await response.json();

// Agrupar por data
const grouped = data.reduce((acc, item) => {
  if (!acc[item.date]) {
    acc[item.date] = { total: 0, success: 0 };
  }
  acc[item.date].total += item.count;
  acc[item.date].success += item.success;
  return acc;
}, {});

console.log(grouped);
```

---

### POST /api/dashboard/run-job/:jobName

Executa um job manualmente.

**Path Parameters**:

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `jobName` | string | Sim | Nome do job a executar |

**Valores válidos para `jobName`**:
- `vetcare_sync`: Sincronização VetCare
- `vaccines`: Reativação de vacinas
- `grooming`: Reativação banho/tosa
- `appointments`: Confirmação de consultas
- `satisfaction`: Pesquisa de satisfação

**Response 200 OK** (Sucesso):

```json
{
  "success": true,
  "message": "Job 'vaccines' executado com sucesso"
}
```

**Response 400 Bad Request** (Job inválido):

```json
{
  "success": false,
  "message": "Job 'invalid_job' não encontrado. Jobs disponíveis: vetcare_sync, vaccines, grooming, appointments, satisfaction"
}
```

**Response 500 Internal Server Error** (Erro na execução):

```json
{
  "success": false,
  "message": "Erro ao executar job 'vaccines': Database connection failed"
}
```

**Exemplo cURL**:

```bash
# Executar sync VetCare
curl -X POST http://localhost:3000/api/dashboard/run-job/vetcare_sync

# Executar reativação de vacinas
curl -X POST http://localhost:3000/api/dashboard/run-job/vaccines

# Executar banho/tosa
curl -X POST http://localhost:3000/api/dashboard/run-job/grooming
```

**Exemplo JavaScript**:

```javascript
async function runJob(jobName) {
  const response = await fetch(`http://localhost:3000/api/dashboard/run-job/${jobName}`, {
    method: 'POST'
  });

  const result = await response.json();

  if (result.success) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`✗ ${result.message}`);
  }

  return result;
}

// Usar
await runJob('vaccines');
```

---

## 🏥 Health Check

### GET /health

Verifica a saúde do sistema e suas dependências.

**Response 200 OK** (Sistema saudável):

```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T12:34:56.789Z",
  "uptime": 86400,
  "database": "connected",
  "services": {
    "vetcare": "available",
    "whatsapp": "available"
  }
}
```

**Response 503 Service Unavailable** (Sistema com problemas):

```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-28T12:34:56.789Z",
  "uptime": 86400,
  "database": "disconnected",
  "services": {
    "vetcare": "unavailable",
    "whatsapp": "available"
  }
}
```

**Campos**:

| Campo | Tipo | Valores | Descrição |
|-------|------|---------|-----------|
| `status` | string | healthy, unhealthy | Status geral |
| `timestamp` | string (ISO 8601) | - | Data/hora da verificação |
| `uptime` | number | - | Tempo de atividade (segundos) |
| `database` | string | connected, disconnected | Status do PostgreSQL |
| `services.vetcare` | string | available, unavailable | Status da VetCare API |
| `services.whatsapp` | string | available, unavailable | Status da Evolution API |

**Exemplo cURL**:

```bash
curl -X GET http://localhost:3000/health
```

**Exemplo JavaScript**:

```javascript
async function checkHealth() {
  const response = await fetch('http://localhost:3000/health');
  const health = await response.json();

  console.log(`Status: ${health.status}`);
  console.log(`Database: ${health.database}`);
  console.log(`VetCare API: ${health.services.vetcare}`);
  console.log(`WhatsApp API: ${health.services.whatsapp}`);
  console.log(`Uptime: ${Math.floor(health.uptime / 3600)} horas`);

  return health.status === 'healthy';
}

// Verificar a cada 30s
setInterval(checkHealth, 30000);
```

**Uso com Monitoramento**:

```bash
# Usar com Uptime Robot, Pingdom, etc.
GET https://seu-dominio.com.br/health

# Verificar via script
#!/bin/bash
STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
  echo "ALERTA: Sistema unhealthy!"
  # Enviar notificação
fi
```

---

## 🔧 Jobs API (Interno)

Essas rotas são chamadas internamente pelos cron jobs.

### VetCare Sync Job

**Execução**: Diária às 04:00

**Fluxo**:
1. `syncCustomers()` - Sincroniza clientes
2. `syncPets()` - Sincroniza pets
3. `syncVaccines()` - Sincroniza vacinas
4. `syncAppointments()` - Sincroniza agendamentos
5. `syncGroomingServices()` - Sincroniza banho/tosa

**Logs**:

```
[2025-10-28 04:00:00] Iniciando sync VetCare (agendado)
[2025-10-28 04:00:15] Clientes: 5535 sincronizados, 0 erros
[2025-10-28 04:02:30] Pets: 5096 sincronizados, 0 erros (10000 limite)
[2025-10-28 04:05:45] Vacinas: 6430 sincronizadas, 12 erros
[2025-10-28 04:08:20] Agendamentos: 5600 sincronizados, 8 erros
[2025-10-28 04:09:15] Banhos: 18 sincronizados, 0 erros
[2025-10-28 04:09:20] Sync VetCare concluído com sucesso
```

### Vaccines Job

**Execução**: Diária às 09:30

**Critérios**:
- Vacina próxima do vencimento (≤ 30 dias)
- OU última dose há mais de 1 ano

**Restrições**:
- Apenas entre 08:00-19:00
- Máximo 1 mensagem/dia por pet
- Delay de 2 minutos entre mensagens

**Logs**:

```
[2025-10-28 09:30:00] Iniciando reativação de vacinas (agendado)
[2025-10-28 09:30:02] Encontradas 87 vacinas para reativação
[2025-10-28 09:45:12] Reativação de vacinas concluída: 82 sucessos, 2 erros, 3 pulados
```

### Grooming Job

**Execução**: Diária às 11:00

**Critérios**:
- Com plano: último banho > 30 dias
- Sem plano: último banho > 60 dias

**Logs**:

```
[2025-10-28 11:00:00] Iniciando reativação de banho/tosa (agendado)
[2025-10-28 11:00:02] Encontrados 32 serviços para reativação
[2025-10-28 11:15:34] Reativação de banho/tosa concluída: 30 sucessos, 1 erro, 1 pulado
```

### Appointments Job

**Execução**: Diária às 08:00

**Critérios**:
- Consultas agendadas para amanhã
- Status = 'agendado'
- Não é retorno

**Logs**:

```
[2025-10-28 08:00:00] Iniciando confirmação de consultas (agendado)
[2025-10-28 08:00:02] Encontradas 19 consultas para confirmar
[2025-10-28 08:12:45] Confirmação de consultas concluída: 19 sucessos, 0 erros, 0 pulados
```

### Satisfaction Job

**Execução**: Diária às 18:00

**Critérios**:
- Atendimento concluído há 24h
- Ainda não recebeu pesquisa

**Logs**:

```
[2025-10-28 18:00:00] Iniciando pesquisa de satisfação (agendado)
[2025-10-28 18:00:02] Encontrados 7 atendimentos concluídos
[2025-10-28 18:05:23] Pesquisa de satisfação concluída: 7 sucessos, 0 erros, 0 pulados
```

---

## 📋 Códigos de Status

| Código | Significado | Descrição |
|--------|-------------|-----------|
| 200 | OK | Requisição bem-sucedida |
| 400 | Bad Request | Parâmetros inválidos |
| 404 | Not Found | Recurso não encontrado |
| 500 | Internal Server Error | Erro interno do servidor |
| 503 | Service Unavailable | Serviço temporariamente indisponível |

---

## 💡 Exemplos de Uso

### Dashboard Simples

```html
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard Simples</title>
</head>
<body>
  <h1>Estatísticas</h1>
  <div id="stats"></div>

  <script>
    async function loadStats() {
      const response = await fetch('http://localhost:3000/api/dashboard/stats');
      const { data } = await response.json();

      document.getElementById('stats').innerHTML = `
        <p>Mensagens Hoje: ${data.messages.today}</p>
        <p>Taxa de Sucesso: ${data.messages.successRate}%</p>
        <p>Clientes: ${data.customers}</p>
        <p>Pets: ${data.pets}</p>
      `;
    }

    loadStats();
    setInterval(loadStats, 30000); // Atualizar a cada 30s
  </script>
</body>
</html>
```

### Python Script

```python
import requests
import time

BASE_URL = "http://localhost:3000"

def get_stats():
    """Retorna estatísticas do dashboard"""
    response = requests.get(f"{BASE_URL}/api/dashboard/stats")
    response.raise_for_status()
    return response.json()['data']

def get_recent_messages(limit=10):
    """Retorna mensagens recentes"""
    response = requests.get(f"{BASE_URL}/api/dashboard/recent-messages?limit={limit}")
    response.raise_for_status()
    return response.json()['data']

def run_job(job_name):
    """Executa um job manualmente"""
    response = requests.post(f"{BASE_URL}/api/dashboard/run-job/{job_name}")
    response.raise_for_status()
    return response.json()

def check_health():
    """Verifica saúde do sistema"""
    response = requests.get(f"{BASE_URL}/health")
    return response.json()

# Usar
if __name__ == "__main__":
    # Verificar saúde
    health = check_health()
    print(f"Status: {health['status']}")

    # Obter stats
    stats = get_stats()
    print(f"Mensagens hoje: {stats['messages']['today']}")

    # Obter mensagens recentes
    messages = get_recent_messages(5)
    for msg in messages:
        print(f"{msg['customer']['name']} - {msg['type']} - {msg['status']}")

    # Executar job (opcional)
    # result = run_job('vaccines')
    # print(result['message'])
```

### Node.js Script

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function getStats() {
  const { data } = await axios.get(`${BASE_URL}/api/dashboard/stats`);
  return data.data;
}

async function getRecentMessages(limit = 10) {
  const { data } = await axios.get(`${BASE_URL}/api/dashboard/recent-messages?limit=${limit}`);
  return data.data;
}

async function runJob(jobName) {
  const { data } = await axios.post(`${BASE_URL}/api/dashboard/run-job/${jobName}`);
  return data;
}

async function checkHealth() {
  const { data } = await axios.get(`${BASE_URL}/health`);
  return data;
}

// Usar
(async () => {
  // Verificar saúde
  const health = await checkHealth();
  console.log(`Status: ${health.status}`);

  // Obter stats
  const stats = await getStats();
  console.log(`Mensagens hoje: ${stats.messages.today}`);

  // Obter mensagens recentes
  const messages = await getRecentMessages(5);
  messages.forEach(msg => {
    console.log(`${msg.customer.name} - ${msg.type} - ${msg.status}`);
  });

  // Executar job (opcional)
  // const result = await runJob('vaccines');
  // console.log(result.message);
})();
```

### Monitoramento com Bash

```bash
#!/bin/bash

# monitor.sh - Monitora saúde do sistema

BASE_URL="http://localhost:3000"
LOG_FILE="/var/log/reativacao_monitor.log"

while true; do
  # Verificar saúde
  HEALTH=$(curl -s "${BASE_URL}/health")
  STATUS=$(echo $HEALTH | jq -r '.status')

  # Log
  echo "[$(date)] Status: $STATUS" >> $LOG_FILE

  # Alertar se unhealthy
  if [ "$STATUS" != "healthy" ]; then
    echo "ALERTA: Sistema unhealthy!" | mail -s "Alerta Reativação Bot" admin@clinica.com.br

    # Tentar reiniciar (opcional)
    # docker service update --force reativa_bs_bot_bot
  fi

  # Aguardar 1 minuto
  sleep 60
done
```

### Integração com Telegram Bot

```python
import requests
from telegram import Bot

TELEGRAM_TOKEN = "seu_token_aqui"
CHAT_ID = "seu_chat_id"
BASE_URL = "http://localhost:3000"

bot = Bot(token=TELEGRAM_TOKEN)

def send_telegram(message):
    """Envia mensagem via Telegram"""
    bot.send_message(chat_id=CHAT_ID, text=message)

def monitor():
    """Monitora sistema e envia alertas"""
    # Verificar saúde
    health = requests.get(f"{BASE_URL}/health").json()

    if health['status'] != 'healthy':
        send_telegram(f"⚠️ Sistema UNHEALTHY!\n\nDatabase: {health['database']}\nVetCare: {health['services']['vetcare']}\nWhatsApp: {health['services']['whatsapp']}")
        return

    # Obter stats do dia
    stats = requests.get(f"{BASE_URL}/api/dashboard/stats").json()['data']

    # Enviar resumo diário (às 19:00)
    from datetime import datetime
    if datetime.now().hour == 19:
        message = f"""
📊 Resumo Diário

✅ Mensagens enviadas: {stats['messages']['today']}
📈 Taxa de sucesso: {stats['messages']['successRate']}%
👥 Clientes: {stats['customers']}
🐾 Pets: {stats['pets']}
        """
        send_telegram(message)

if __name__ == "__main__":
    import time
    while True:
        try:
            monitor()
        except Exception as e:
            send_telegram(f"❌ Erro no monitor: {e}")
        time.sleep(300)  # 5 minutos
```

---

## 🔗 Links Úteis

- [Documentação Express.js](https://expressjs.com/)
- [Documentação PostgreSQL](https://www.postgresql.org/docs/)
- [Evolution API Docs](https://doc.evolution-api.com/)
- [Chart.js Docs](https://www.chartjs.org/docs/)

---

**APIs prontas para integração!** 📡

*Última atualização: Outubro 2025*
