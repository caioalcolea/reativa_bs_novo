# 🐾 Sistema de Reativação Automática - Clínica Bicho Solto

Sistema automatizado de reativação de clientes via WhatsApp para clínicas veterinárias, integrado com VetCare API e Evolution API.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-18.x-green)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Características](#-características)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Deploy](#-deploy)
- [Configuração](#-configuração)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Dashboard](#-dashboard)
- [Fluxos de Mensagens](#-fluxos-de-mensagens)
- [Documentação Adicional](#-documentação-adicional)
- [Suporte](#-suporte)

## 🎯 Visão Geral

O Sistema de Reativação Automática é uma solução completa para clínicas veterinárias que automatiza o envio de mensagens via WhatsApp para:

- 💉 **Lembretes de Vacinas**: Notifica clientes quando vacinas estão próximas do vencimento
- 🛁 **Reativação de Banho & Tosa**: Sugere agendamentos e planos mensais
- 📅 **Confirmação de Consultas**: Confirma consultas agendadas 1 dia antes
- ⭐ **Pesquisa de Satisfação**: Coleta feedback pós-atendimento

### Diferenciais

- ✅ **Mensagens Humanizadas**: Tom amigável e profissional
- ✅ **Horário Comercial**: Envios apenas entre 08:00-19:00
- ✅ **Anti-Spam**: Máximo 1 mensagem por dia por pet/função
- ✅ **Dashboard Moderno**: Interface Spotify-style ultra-moderna
- ✅ **Dados Reais**: 100% integrado com VetCare
- ✅ **Escalável**: Docker Swarm ready

## 🚀 Características

### Sincronização VetCare

- Sync diário às 04:00 (horário de baixo tráfego)
- Suporta até 10.000 pets
- Detecção inteligente de duplicatas
- Validação de integridade referencial (FK)
- Normalização automática de telefones (formato +55)

### Controles de Mensagens

- **Horário**: 08:00 - 19:00 (nunca à noite)
- **Delay**: 2 minutos entre mensagens
- **Frequência**: Máximo 1 mensagem/dia por função/pet
- **Validação**: Telefones WhatsApp válidos

### Dashboard Ultra-Moderno

- Layout Spotify-style com sidebar
- Modo claro (light theme) apenas
- Logo TalkHub azul em fundo branco
- Stats em tempo real
- Gráficos interativos (Chart.js)
- Auto-refresh a cada 30s
- Execução manual de jobs

## 🛠 Tecnologias

### Backend

- **Node.js** 18.x - Runtime JavaScript
- **TypeScript** 5.x - Linguagem tipada
- **Express** 4.x - Framework web
- **PostgreSQL** 14+ - Banco de dados

### APIs Integradas

- **VetCare API** - Sistema veterinário (vet.talkhub.me)
- **Evolution API** - WhatsApp Business

### DevOps

- **Docker** - Containerização
- **Docker Swarm** - Orquestração
- **Traefik** - Reverse proxy + SSL

### Frontend

- **Chart.js** - Gráficos interativos
- **Tailwind CSS** - Framework CSS
- **Font Awesome** - Ícones

## 📦 Pré-requisitos

### Servidor

- Ubuntu 20.04+ ou Debian 11+
- Docker 20.10+
- Docker Compose 2.x
- 2GB RAM mínimo
- 10GB disco disponível

### Credenciais Necessárias

- URL da Evolution API
- API Key da Evolution API
- Instance Name (WhatsApp conectado)
- URL da VetCare API
- Credenciais PostgreSQL

## 📥 Instalação

### 1. Clone o Repositório

```bash
git clone https://github.com/caioalcolea/reativa_bs_novo.git
cd reativa_bs_novo
```

### 2. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Servidor
NODE_ENV=production
PORT=3000

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=reativacao_vet
DB_USER=postgres
DB_PASSWORD=sua_senha_segura_aqui

# VetCare API
VETCARE_API_URL=https://vet.talkhub.me/api
VETCARE_API_KEY=sua_api_key_aqui

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://evolution.talkhub.me
EVOLUTION_API_KEY=sua_evolution_key_aqui
EVOLUTION_INSTANCE_NAME=clinica_bicho_solto

# Cron Jobs
CRON_VETCARE_SYNC=0 4 * * *
CRON_VACCINES=30 9 * * *
CRON_GROOMING=0 11 * * *
CRON_APPOINTMENTS=0 8 * * *
CRON_SATISFACTION=0 18 * * *

# Mensagens
MESSAGING_START_HOUR=8
MESSAGING_END_HOUR=19
MESSAGING_DELAY_MS=120000
```

### 3. Instale as Dependências

```bash
npm install
```

### 4. Compile o TypeScript

```bash
npm run build
```

### 5. Configure o Banco de Dados

```bash
# Executar schema no PostgreSQL
psql -U postgres -d reativacao_vet -f database_schema_postgres.sql
```

## 🚀 Deploy

### Deploy com Docker Swarm (RECOMENDADO)

O sistema foi projetado para deploy via Docker Swarm. Use o script automatizado:

```bash
chmod +x deploy_swarm.sh
./deploy_swarm.sh
```

O script irá:

1. ✅ Verificar se o Swarm está ativo
2. ✅ Criar a rede overlay
3. ✅ Fazer build da imagem
4. ✅ Fazer deploy do stack completo
5. ✅ Verificar saúde dos serviços

Para mais detalhes, consulte [DEPLOY.md](./DEPLOY.md)

### Deploy Manual (Desenvolvimento)

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## ⚙️ Configuração

### Cron Jobs

O sistema executa os seguintes jobs automaticamente:

| Job | Horário | Descrição |
|-----|---------|-----------|
| VetCare Sync | 04:00 | Sincroniza clientes, pets, vacinas, etc |
| Vacinas | 09:30 | Envia lembretes de vacinas vencidas/próximas |
| Banho & Tosa | 11:00 | Reativa clientes para banho |
| Consultas | 08:00 | Confirma consultas do dia seguinte |
| Satisfação | 18:00 | Envia pesquisa pós-atendimento |

### Personalizar Horários

Edite o arquivo `.env`:

```bash
# Exemplo: Mudar sync para 02:00
CRON_VETCARE_SYNC=0 2 * * *

# Exemplo: Vacinas às 10:00
CRON_VACCINES=0 10 * * *
```

### Limites de Sincronização

```typescript
// src/services/vetcareApiService.ts
const MAX_PETS = 10000; // Altere conforme necessário
```

## 📁 Estrutura do Projeto

```
reativa_bs_novo/
├── src/
│   ├── config/              # Configurações
│   │   ├── database.ts      # Conexão PostgreSQL
│   │   └── index.ts         # Config geral + cron
│   ├── modules/             # Módulos de negócio
│   │   ├── vaccines/        # Reativação de vacinas
│   │   ├── grooming/        # Reativação banho/tosa
│   │   ├── appointments/    # Confirmação consultas
│   │   └── satisfaction/    # Pesquisa satisfação
│   ├── routes/              # Rotas HTTP
│   │   ├── dashboard.ts     # API do dashboard
│   │   └── health.ts        # Health check
│   ├── services/            # Serviços
│   │   ├── vetcareApiService.ts  # Integração VetCare
│   │   └── whatsappService.ts    # Integração WhatsApp
│   ├── utils/               # Utilitários
│   │   ├── logger.ts        # Sistema de logs
│   │   ├── dateHelpers.ts   # Helpers de data
│   │   └── messaging.ts     # Controles de mensagens
│   ├── types/               # TypeScript types
│   ├── public/              # Arquivos estáticos
│   │   └── dashboard.html   # Dashboard UI
│   └── index.ts             # Entry point
├── database_schema_postgres.sql  # Schema do banco
├── deploy_swarm.sh          # Script de deploy
├── docker-compose.yml       # Docker Compose
├── Dockerfile               # Imagem Docker
├── package.json             # Dependências
└── tsconfig.json            # Config TypeScript
```

## 📊 Dashboard

Acesse o dashboard moderno em: `http://seu-servidor:3000/dashboard`

### Características

- **Sidebar Navigation**: 9 seções organizadas
- **Stats Cards**: 4 cards com métricas em tempo real
- **Gráficos**:
  - Mensagens por tipo (doughnut)
  - Evolução semanal (line)
- **Ações Manuais**: Execute jobs sob demanda
- **Mensagens Recentes**: Últimas 15 mensagens
- **Auto-refresh**: Atualiza a cada 30s

### Navegação

- 📊 Dashboard
- 👥 Clientes
- 🐾 Pets
- 📧 Mensagens
- 📅 Agendamentos
- 💉 Vacinas
- 🚿 Banho & Tosa
- ⭐ Satisfação
- ⚙️ Configurações

## 💬 Fluxos de Mensagens

### 1. Vacinas

**Gatilho**: Vacinas vencidas ou próximas do vencimento

**Mensagem**:
```
📢 *Lembrete de Vacinação – Clínica Bicho Solto* 🐾

Olá, *João Silva*! Tudo bem? 😊
Está na hora da vacinação do(a) *Rex* 💉

Manter as vacinas em dia é essencial para garantir a saúde
e o bem-estar dele(a)! 🐶🐱

Podemos agendar o horário e manter a proteção dele(a) em dia?

Cuidar de quem a gente ama é o melhor investimento! ❤️
```

### 2. Banho & Tosa

**Gatilho**: Último banho há mais de 30 dias (sem plano) ou 30 dias (com plano mensal)

**Mensagem com Plano**:
```
📢 *Lembrete de Banho – Clínica Bicho Solto* 🐾

Olá, *Maria Santos*! Tudo bem? 😊

Só lembrando que *Luna* está com o plano de banho mensal ativo! 🛁✨

📅 Último banho: *15/09/2025*

Que tal agendar o próximo banho? Temos horários disponíveis e
seu pet vai ficar feliz e cheirosinho! 🐶🐱💙

Responda esta mensagem para agendar! Estamos à disposição! 😊
```

**Mensagem sem Plano**:
```
📢 *Lembrete de Banho – Clínica Bicho Solto* 🐾

Olá, *Pedro Costa*! Tudo bem? 😊

Já faz um tempinho desde o último banho do(a) *Thor* (20/08/2025)! 🛁

Que tal agendar um banho fresquinho? Seu pet vai adorar! 😊

💰 *Temos planos com desconto especial para você:*

📦 *Plano Mensal Básico*
   💵 R$ 89,90/mês
   📝 1 banho + tosa por mês

📦 *Plano Mensal Premium*
   💵 R$ 149,90/mês
   📝 2 banhos + tosa + hidratação

Gostaria de agendar um banho ou conhecer mais sobre nossos planos? 📞
```

### 3. Consultas

**Gatilho**: Consultas agendadas para o dia seguinte

**Mensagem**:
```
📢 *Confirmação de Consulta – Clínica Bicho Solto* 🐾

Olá, *Ana Paula*! 😊

Estamos entrando em contato para *confirmar* a consulta do(a) *Mia*:

📅 *Data:* 29/10/2025
⏰ *Horário:* 14:30
🏥 *Tipo:* Consulta

Por favor, confirme a presença respondendo:
✅ *SIM* - para confirmar
❌ *NÃO* - caso precise remarcar

Sua presença é muito importante para a saúde do(a) Mia! 💙

Se precisar de mais informações ou quiser remarcar, estamos à
disposição! 😊

Aguardamos sua confirmação! 📞
```

### 4. Satisfação

**Gatilho**: 24 horas após atendimento concluído

**Mensagem**:
```
🌟 *Pesquisa de Satisfação – Clínica Bicho Solto*

Olá! Tudo bem? 😊

Gostaríamos muito de saber sua opinião sobre o atendimento
do(a) *Beethoven*!

Como você avalia nosso atendimento?

⭐⭐⭐⭐⭐ Excelente
⭐⭐⭐⭐ Muito Bom
⭐⭐⭐ Bom
⭐⭐ Regular
⭐ Precisa Melhorar

Sua opinião é muito importante para melhorarmos ainda mais! 💙

Se puder, deixe também uma avaliação no Google:
[link para Google Reviews]

Obrigado pela confiança! 🐾
```

## 📚 Documentação Adicional

- [DEPLOY.md](./DEPLOY.md) - Instruções detalhadas de deploy
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [API.md](./API.md) - Documentação das APIs e rotas

## 🔍 Monitoramento

### Logs

```bash
# Logs do bot
docker service logs -f reativa_bs_bot_bot

# Logs do PostgreSQL
docker service logs -f reativa_bs_bot_postgres

# Logs de todos os serviços
docker service logs -f $(docker service ls -q)
```

### Health Check

```bash
# Via curl
curl http://localhost:3000/health

# Resposta esperada:
{
  "status": "healthy",
  "timestamp": "2025-10-28T17:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "services": {
    "vetcare": "available",
    "whatsapp": "available"
  }
}
```

### Métricas

O dashboard fornece métricas em tempo real:

- Total de mensagens enviadas hoje
- Taxa de sucesso
- Clientes ativos
- Pets cadastrados
- Agendamentos próximos

## 🔧 Troubleshooting

### Problema: Mensagens não estão sendo enviadas

**Solução**:
1. Verifique se o horário está entre 08:00-19:00
2. Confirme se a Evolution API está conectada
3. Valide o telefone do cliente (formato +5519999999999)
4. Verifique logs: `docker service logs reativa_bs_bot_bot`

### Problema: Sync VetCare falhando

**Solução**:
1. Teste a API: `curl https://vet.talkhub.me/api/pets`
2. Verifique a API key no `.env`
3. Confirme conectividade com o servidor VetCare
4. Aumente timeout se necessário

### Problema: Dashboard não carrega dados

**Solução**:
1. Verifique conexão com PostgreSQL
2. Confirme que há dados sincronizados
3. Inspecione console do navegador (F12)
4. Teste API: `curl http://localhost:3000/api/dashboard/stats`

## 🤝 Suporte

### Contatos

- **Desenvolvedor**: Claude AI + Caio Alcolea
- **Email**: suporte@clinicabichosolto.com.br
- **Telefone**: (19) 99999-9999

### Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Licença

Este projeto é proprietário da Clínica Bicho Solto.

## 🎉 Agradecimentos

- VetCare pela API robusta
- Evolution API pela integração WhatsApp
- Comunidade Node.js/TypeScript

---

**Desenvolvido com ❤️ para Clínica Bicho Solto**

🐾 *Cuidando de quem a gente ama!*
