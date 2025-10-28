# 🚀 Guia de Deploy - Docker Swarm

Este guia detalha o processo completo de deploy do Sistema de Reativação Automática usando Docker Swarm.

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Preparação do Servidor](#preparação-do-servidor)
- [Deploy Automatizado](#deploy-automatizado)
- [Deploy Manual](#deploy-manual)
- [Verificação](#verificação)
- [Atualização](#atualização)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

## ✅ Pré-requisitos

### Servidor

```bash
# Sistema Operacional
Ubuntu 20.04+ ou Debian 11+

# Hardware Mínimo
- CPU: 2 cores
- RAM: 2GB
- Disco: 10GB livre

# Hardware Recomendado (Produção)
- CPU: 4 cores
- RAM: 4GB
- Disco: 20GB livre
```

### Software

```bash
# Docker
Docker Engine 20.10+
Docker Compose 2.x

# Verificar versões
docker --version
docker compose version
```

### Instalação do Docker (se necessário)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Recarregar grupos
newgrp docker

# Verificar instalação
docker run hello-world
```

## 🔧 Preparação do Servidor

### 1. Clonar o Repositório

```bash
# SSH
git clone git@github.com:caioalcolea/reativa_bs_novo.git

# HTTPS
git clone https://github.com/caioalcolea/reativa_bs_novo.git

# Entrar no diretório
cd reativa_bs_novo
```

### 2. Checkout para a Branch de Produção

```bash
# Verificar branches disponíveis
git branch -a

# Checkout para a branch de produção
git checkout claude/session-011CUYkxMVA3ozey5oRbJeFP

# Verificar commit atual
git log -1 --oneline
```

### 3. Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
nano .env
```

Adicione as seguintes variáveis:

```bash
# Servidor
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=reativacao_vet
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_SUPER_SEGURA_AQUI_123

# VetCare API
VETCARE_API_URL=https://vet.talkhub.me/api
VETCARE_API_KEY=sua_vetcare_api_key_aqui

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://evolution.talkhub.me
EVOLUTION_API_KEY=sua_evolution_api_key_aqui
EVOLUTION_INSTANCE_NAME=clinica_bicho_solto

# Cron Jobs (não altere a menos que necessário)
CRON_VETCARE_SYNC=0 4 * * *
CRON_VACCINES=30 9 * * *
CRON_GROOMING=0 11 * * *
CRON_APPOINTMENTS=0 8 * * *
CRON_SATISFACTION=0 18 * * *

# Controles de Mensagens
MESSAGING_START_HOUR=8
MESSAGING_END_HOUR=19
MESSAGING_DELAY_MS=120000
```

**IMPORTANTE**: Altere as senhas e API keys!

### 4. Verificar Configuração

```bash
# Validar sintaxe do .env
cat .env | grep -v '^#' | grep -v '^$'

# Contar variáveis configuradas
cat .env | grep -v '^#' | grep -v '^$' | wc -l
# Deve mostrar ~18 variáveis
```

## 🎯 Deploy Automatizado

### Método 1: Script Automatizado (RECOMENDADO)

O script `deploy_swarm.sh` faz tudo automaticamente:

```bash
# Dar permissão de execução
chmod +x deploy_swarm.sh

# Executar deploy
./deploy_swarm.sh
```

O script irá:

1. ✅ Verificar se o Docker Swarm está ativo
2. ✅ Inicializar o Swarm (se necessário)
3. ✅ Criar a rede overlay `reativacao_network`
4. ✅ Fazer build da imagem Docker
5. ✅ Fazer deploy do stack completo
6. ✅ Verificar saúde dos serviços

**Output esperado**:

```
==========================================
Sistema de Reativação Automática - Deploy
==========================================

[1/6] Verificando Docker Swarm...
✓ Swarm está ativo

[2/6] Criando rede overlay...
✓ Rede reativacao_network criada

[3/6] Construindo imagem Docker...
✓ Imagem construída com sucesso

[4/6] Fazendo deploy do stack...
✓ Stack reativa_bs_bot deployed

[5/6] Aguardando serviços iniciarem...
✓ Serviços prontos

[6/6] Verificando saúde dos serviços...
✓ reativa_bs_bot_postgres: running (1/1)
✓ reativa_bs_bot_bot: running (1/1)

==========================================
Deploy concluído com sucesso! ✓
==========================================

Dashboard: http://SEU_IP:3000/dashboard
Health Check: http://SEU_IP:3000/health
```

### Método 2: Docker Stack Deploy

```bash
# Inicializar Swarm (primeira vez)
docker swarm init

# Criar rede
docker network create --driver overlay reativacao_network

# Deploy
docker stack deploy -c docker-compose.yml reativa_bs_bot

# Verificar
docker stack services reativa_bs_bot
```

## 📝 Deploy Manual

### Passo 1: Inicializar Docker Swarm

```bash
# Inicializar
docker swarm init

# Verificar status
docker info | grep Swarm
# Deve mostrar: Swarm: active
```

### Passo 2: Criar Rede Overlay

```bash
# Criar rede
docker network create \
  --driver overlay \
  --attachable \
  reativacao_network

# Listar redes
docker network ls | grep reativacao_network
```

### Passo 3: Build da Imagem

```bash
# Build local
docker build -t reativacao-bot:latest .

# Verificar imagem
docker images | grep reativacao-bot
```

### Passo 4: Deploy do PostgreSQL

```bash
# Criar volume para dados
docker volume create postgres_data

# Deploy do serviço
docker service create \
  --name postgres \
  --network reativacao_network \
  --env POSTGRES_DB=reativacao_vet \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=${DB_PASSWORD} \
  --mount type=volume,source=postgres_data,target=/var/lib/postgresql/data \
  --replicas 1 \
  postgres:14
```

### Passo 5: Aguardar PostgreSQL Iniciar

```bash
# Aguardar 30 segundos
sleep 30

# Verificar logs
docker service logs postgres
```

### Passo 6: Criar Schema do Banco

```bash
# Copiar schema para container
docker ps | grep postgres
# Anotar o CONTAINER_ID

docker cp database_schema_postgres.sql CONTAINER_ID:/tmp/

# Executar schema
docker exec CONTAINER_ID psql -U postgres -d reativacao_vet -f /tmp/database_schema_postgres.sql
```

### Passo 7: Deploy do Bot

```bash
# Deploy do serviço
docker service create \
  --name bot \
  --network reativacao_network \
  --env-file .env \
  --publish 3000:3000 \
  --replicas 1 \
  reativacao-bot:latest
```

### Passo 8: Verificar Deploy

```bash
# Listar serviços
docker service ls

# Deve mostrar:
# ID      NAME       MODE        REPLICAS   IMAGE
# xxx     postgres   replicated  1/1        postgres:14
# yyy     bot        replicated  1/1        reativacao-bot:latest
```

## ✔️ Verificação

### 1. Status dos Serviços

```bash
# Verificar stack
docker stack services reativa_bs_bot

# Verificar réplicas
docker service ls
```

**Output esperado**:

```
NAME                      REPLICAS   IMAGE
reativa_bs_bot_postgres   1/1        postgres:14
reativa_bs_bot_bot        1/1        reativacao-bot:latest
```

### 2. Logs

```bash
# Logs do bot (últimas 50 linhas)
docker service logs --tail 50 reativa_bs_bot_bot

# Logs do PostgreSQL
docker service logs --tail 50 reativa_bs_bot_postgres

# Seguir logs em tempo real
docker service logs -f reativa_bs_bot_bot
```

### 3. Health Check

```bash
# Via curl
curl http://localhost:3000/health

# Via navegador
firefox http://localhost:3000/health
```

**Resposta esperada**:

```json
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

### 4. Dashboard

```bash
# Abrir dashboard
firefox http://localhost:3000/dashboard
```

Deve carregar:
- ✅ Sidebar com navegação
- ✅ Cards de estatísticas
- ✅ Gráficos
- ✅ Tabela de mensagens

### 5. Banco de Dados

```bash
# Conectar ao PostgreSQL
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d reativacao_vet

# Verificar tabelas
\dt

# Deve mostrar:
# customers, pets, vaccines, appointments, grooming_services, reactivation_logs, etc.

# Contar registros
SELECT
  (SELECT COUNT(*) FROM customers) as clientes,
  (SELECT COUNT(*) FROM pets) as pets,
  (SELECT COUNT(*) FROM vaccines) as vacinas;

# Sair
\q
```

## 🔄 Atualização

### Atualizar Sistema

```bash
# 1. Fazer pull das alterações
git pull origin claude/session-011CUYkxMVA3ozey5oRbJeFP

# 2. Rebuild da imagem
docker build -t reativacao-bot:latest .

# 3. Atualizar serviço (zero downtime)
docker service update \
  --image reativacao-bot:latest \
  reativa_bs_bot_bot

# 4. Verificar
docker service ps reativa_bs_bot_bot
```

### Atualizar Configurações

```bash
# 1. Editar .env
nano .env

# 2. Atualizar serviço com novas variáveis
docker service update \
  --env-add NOVA_VARIAVEL=valor \
  reativa_bs_bot_bot

# 3. Ou remover o serviço e redeployar
docker stack rm reativa_bs_bot
sleep 10
docker stack deploy -c docker-compose.yml reativa_bs_bot
```

## ↩️ Rollback

### Rollback para Versão Anterior

```bash
# 1. Listar histórico de atualizações
docker service inspect reativa_bs_bot_bot --format='{{json .UpdateStatus}}'

# 2. Rollback
docker service rollback reativa_bs_bot_bot

# 3. Verificar
docker service ps reativa_bs_bot_bot
```

### Rollback via Git

```bash
# 1. Ver histórico
git log --oneline -5

# 2. Checkout para commit anterior
git checkout COMMIT_HASH

# 3. Rebuild e redeploy
docker build -t reativacao-bot:latest .
docker service update --image reativacao-bot:latest reativa_bs_bot_bot
```

## 🐛 Troubleshooting

### Problema: Serviço não inicia

```bash
# Verificar status
docker service ps reativa_bs_bot_bot

# Ver erro detalhado
docker service ps --no-trunc reativa_bs_bot_bot

# Verificar logs
docker service logs reativa_bs_bot_bot
```

**Soluções comuns**:

1. **Falta de recursos**:
```bash
# Verificar recursos
docker stats

# Aumentar limites
docker service update \
  --limit-memory 1G \
  --limit-cpu 1 \
  reativa_bs_bot_bot
```

2. **Porta em uso**:
```bash
# Verificar porta 3000
sudo lsof -i :3000

# Matar processo
sudo kill -9 PID
```

3. **Variáveis de ambiente**:
```bash
# Verificar variáveis
docker service inspect reativa_bs_bot_bot | grep Env

# Corrigir
docker service update --env-add VAR=valor reativa_bs_bot_bot
```

### Problema: PostgreSQL não conecta

```bash
# Verificar se está rodando
docker service ps reativa_bs_bot_postgres

# Testar conexão
docker run --rm --network reativacao_network postgres:14 \
  psql -h postgres -U postgres -d reativacao_vet -c "SELECT 1"

# Verificar senha
echo $DB_PASSWORD

# Resetar senha
docker service update \
  --env-add POSTGRES_PASSWORD=nova_senha \
  reativa_bs_bot_postgres
```

### Problema: Rede não funciona

```bash
# Listar redes
docker network ls

# Inspecionar rede
docker network inspect reativacao_network

# Recriar rede
docker network rm reativacao_network
docker network create --driver overlay reativacao_network

# Reconectar serviços
docker service update --network-add reativacao_network reativa_bs_bot_bot
```

### Problema: Build falha

```bash
# Limpar cache
docker builder prune -a

# Rebuild sem cache
docker build --no-cache -t reativacao-bot:latest .

# Verificar espaço em disco
df -h
docker system df
```

### Problema: Logs não aparecem

```bash
# Verificar nível de log
docker service inspect reativa_bs_bot_bot | grep LOG_LEVEL

# Alterar para debug
docker service update --env-add LOG_LEVEL=debug reativa_bs_bot_bot

# Ver todos os logs
docker service logs --raw --timestamps reativa_bs_bot_bot
```

## 🔐 Segurança

### Configurar Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 3000/tcp
sudo ufw allow 2377/tcp  # Swarm management
sudo ufw allow 7946/tcp  # Swarm communication
sudo ufw allow 7946/udp
sudo ufw allow 4789/udp  # Overlay network
sudo ufw enable

# Verificar
sudo ufw status
```

### SSL/TLS com Traefik

```bash
# Adicionar Traefik ao docker-compose.yml
# Ver exemplo completo na documentação do Traefik

# Labels no serviço bot:
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.bot.rule=Host(`bot.seudominio.com`)"
  - "traefik.http.routers.bot.entrypoints=websecure"
  - "traefik.http.routers.bot.tls.certresolver=letsencrypt"
```

### Backup Automático

```bash
# Criar script de backup
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/reativacao"

# Criar diretório
mkdir -p $BACKUP_DIR

# Backup do banco
docker exec $(docker ps -qf "name=postgres") \
  pg_dump -U postgres reativacao_vet > $BACKUP_DIR/db_$DATE.sql

# Comprimir
gzip $BACKUP_DIR/db_$DATE.sql

# Manter apenas últimos 7 dias
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup concluído: db_$DATE.sql.gz"
```

```bash
# Agendar no cron (diariamente às 02:00)
crontab -e

# Adicionar linha:
0 2 * * * /path/to/backup.sh
```

## 📊 Monitoramento

### Prometheus + Grafana (Opcional)

```bash
# Adicionar ao docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
```

### Logs Centralizados

```bash
# Enviar logs para arquivo
docker service logs -f reativa_bs_bot_bot >> /var/log/reativacao_bot.log 2>&1 &

# Rotação de logs
sudo nano /etc/logrotate.d/reativacao

# Adicionar:
/var/log/reativacao_bot.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

## 📞 Suporte

Em caso de problemas:

1. Consulte os logs: `docker service logs reativa_bs_bot_bot`
2. Verifique o health check: `curl http://localhost:3000/health`
3. Revise as variáveis de ambiente
4. Abra uma issue no GitHub
5. Entre em contato: suporte@clinicabichosolto.com.br

---

**Deploy preparado para produção!** 🚀

*Última atualização: Outubro 2025*
