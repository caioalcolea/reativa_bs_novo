# Bot de Reativação - Clínica Veterinária (Docker Swarm + PostgreSQL)

Sistema automático de reativação e engajamento de clientes para clínicas veterinárias, com integração ao WhatsApp via Evolution API.

## 🆕 Mudanças Principais

- ✅ **PostgreSQL** ao invés de MySQL (compatível com infraestrutura existente)
- ✅ **Docker Swarm** pronto para produção
- ✅ **Evolution API** integrada corretamente
- ✅ **Porta 2080** (não conflita com serviços existentes)
- ✅ **Traefik** com SSL/TLS automático

## Funcionalidades

### 1. Reativação de Vacinas
- Monitoramento diário de vacinas vencidas ou próximas ao vencimento
- Reativação 21 dias antes da próxima dose
- Reativação alternativa 7 dias antes se a dose estiver entre 14-21 dias
- Reativação de vacinas anuais 30 dias antes do vencimento de 1 ano

### 2. Reativação Financeira
- Identificação de débitos em atraso
- Mensagens sutis para valores menores
- Cobranças formais para valores acima de R$ 300
- Limite de 1 cobrança a cada 30 dias por débito

### 3. Reativação de Banhos e Tosas
- Lembretes semanais para clientes com plano mensal
- Lembretes mensais (30 dias) para banhos únicos
- Ofertas de planos com desconto
- Verificação de planos específicos por raça

### 4. Confirmação de Consultas
- Confirmação automática 1 dia antes da consulta
- Não envia para retornos ou consultas já agendadas
- Verificação de consultas futuras

### 5. Pesquisa de Satisfação
- Envio automático após conclusão de serviços
- Formulários específicos por tipo de serviço
- Redirecionamento para Google Reviews (3+ estrelas)

## Requisitos

- Docker 20.10+
- Docker Swarm ativo
- PostgreSQL 14+ (pode usar o Supabase existente)
- Traefik rodando
- Conta TalkHub (Evolution API)
- Domínio: automacaobs.talkhub.me

## Instalação Rápida

### 1. Setup do PostgreSQL

Ver guia completo em [POSTGRES_SETUP.md](POSTGRES_SETUP.md)

```bash
# Opção 1: Usar Postgres do Supabase (Recomendado)
docker exec -it postgres_postgres.1.byodefogahamy9w9gwfvvsxdg psql -U postgres

# Dentro do psql:
CREATE DATABASE bot_reativacao_vet ENCODING 'UTF8';
\q

# Importar schema
docker exec -i postgres_postgres.1.byodefogahamy9w9gwfvvsxdg psql -U postgres -d bot_reativacao_vet < database_schema_postgres.sql
```

### 2. Configurar variáveis

```bash
# Copiar exemplo
cp .env.example .env

# Editar
nano .env
`
### 4. Verificar

```bash
# Ver status
docker stack ps reativa_bicho_solto

# Ver logs
docker service logs -f reativa_bicho_solto_bot-reativacao

# Health check
curl https://automacaobs.talkhub.me/health

# Status dos jobs
curl https://automacaobs.talkhub.me/status
```

## Comandos Úteis

### Gerenciamento do Stack

```bash
# Ver status
docker stack ps reativa_bicho_solto

# Ver serviços
docker stack services reativa_bicho_solto

# Ver logs
docker service logs -f reativa_bicho_solto_bot-reativacao

# Atualizar (após mudanças)
./deploy_swarm.sh

# Remover stack
docker stack rm reativa_bicho_solto

# Escalar
docker service scale reativa_bicho_solto_bot-reativacao=2
```



## Backup

```bash
# Backup do PostgreSQL
docker exec postgres_postgres.1.byodefogahamy9w9gwfvvsxdg pg_dump -U postgres bot_reativacao_vet > backup_bot_$(date +%Y%m%d).sql

# Restore
docker exec -i postgres_postgres.1.byodefogahamy9w9gwfvvsxdg psql -U postgres -d bot_reativacao_vet < backup_bot_20241027.sql
```

## Atualização

```bash
# 1. Pull das mudanças
git pull

# 2. Rebuild e redeploy
./deploy_swarm.sh

# O script faz rolling update automático sem downtime
```

## Suporte

- 📖 [Guia PostgreSQL](POSTGRES_SETUP.md)
- 🐛 [Troubleshooting](TROUBLESHOOTING.md)
- 🚀 [Deployment](DEPLOYMENT.md)

## Licença

MIT

## Versão

2.0.0 (PostgreSQL + Docker Swarm)
