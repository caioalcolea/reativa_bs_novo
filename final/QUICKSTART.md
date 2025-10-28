# ⚡ Quick Start Guide

Guia rápido para colocar o Sistema de Reativação Automática em produção em **menos de 10 minutos**.

## 📦 Pré-requisitos

✅ Servidor Ubuntu/Debian com Docker instalado
✅ Credenciais da VetCare API
✅ Credenciais da Evolution API (WhatsApp)
✅ PostgreSQL disponível (ou usar o incluído no Docker Compose)

## 🚀 Deploy em 5 Passos

### 1. Clone o Repositório

```bash
git clone https://github.com/caioalcolea/reativa_bs_novo.git
cd reativa_bs_novo

# Checkout para a branch de produção
git checkout claude/session-011CUYkxMVA3ozey5oRbJeFP
```

### 2. Configure as Variáveis

```bash
# Copiar template
cp .env.example .env

# Editar com suas credenciais
nano .env
```

**Variáveis OBRIGATÓRIAS**:

```bash
# PostgreSQL
DB_PASSWORD=SUA_SENHA_SUPER_SEGURA

# VetCare
VETCARE_API_KEY=sua_vetcare_key

# Evolution (WhatsApp)
EVOLUTION_API_KEY=sua_evolution_key
EVOLUTION_INSTANCE_NAME=nome_da_instancia
```

### 3. Deploy Automático

```bash
# Dar permissão
chmod +x deploy_swarm.sh

# Executar deploy
./deploy_swarm.sh
```

Aguarde ~2 minutos. O script irá:
- ✅ Inicializar Docker Swarm
- ✅ Criar rede overlay
- ✅ Buildar imagem
- ✅ Deploy do stack
- ✅ Verificar saúde

### 4. Verificar

```bash
# Status dos serviços
docker service ls

# Logs
docker service logs -f reativa_bs_bot_bot

# Health check
curl http://localhost:3000/health
```

**Esperado**:

```json
{
  "status": "healthy",
  "database": "connected",
  "services": {
    "vetcare": "available",
    "whatsapp": "available"
  }
}
```

### 5. Acessar Dashboard

Abra no navegador:

```
http://SEU_IP:3000/dashboard
```

Você verá:
- ✅ Sidebar Spotify-style
- ✅ Stats em tempo real
- ✅ Gráficos interativos
- ✅ Mensagens recentes

## ✅ Checklist Pós-Deploy

```bash
# [ ] Serviços rodando
docker service ls
# Deve mostrar 2/2 réplicas

# [ ] Banco populado
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d reativacao_vet -c "SELECT COUNT(*) FROM customers;"
# Deve mostrar > 0 após primeiro sync

# [ ] Dashboard acessível
curl -I http://localhost:3000/dashboard
# Deve retornar 200 OK

# [ ] Health check OK
curl http://localhost:3000/health | jq '.status'
# Deve retornar "healthy"

# [ ] Cron jobs agendados
docker service logs reativa_bs_bot_bot | grep "Cron job"
# Deve mostrar jobs agendados
```

## 🎯 Próximos Passos

### 1. Aguardar Primeiro Sync (04:00)

O sistema sincroniza automaticamente às 04:00. Para testar agora:

```bash
# Executar sync manual
curl -X POST http://localhost:3000/api/dashboard/run-job/vetcare_sync
```

### 2. Testar Envio de Mensagens

Após o sync, teste manualmente:

```bash
# Enviar lembretes de vacinas
curl -X POST http://localhost:3000/api/dashboard/run-job/vaccines
```

**ATENÇÃO**: Mensagens só são enviadas entre 08:00-19:00!

### 3. Monitorar Logs

```bash
# Seguir logs em tempo real
docker service logs -f reativa_bs_bot_bot

# Filtrar por módulo
docker service logs reativa_bs_bot_bot | grep "vaccines"
```

### 4. Configurar SSL (Produção)

```bash
# Instalar Certbot
sudo apt install certbot

# Obter certificado
sudo certbot certonly --standalone -d bot.seudominio.com

# Configurar Traefik (ver DEPLOY.md)
```

### 5. Backup Automático

```bash
# Criar script de backup
nano /usr/local/bin/backup-reativacao.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec $(docker ps -qf "name=postgres") \
  pg_dump -U postgres reativacao_vet | gzip > /backup/db_$DATE.sql.gz
```

```bash
# Agendar no cron (02:00 diariamente)
sudo crontab -e

# Adicionar:
0 2 * * * /usr/local/bin/backup-reativacao.sh
```

## 🔧 Comandos Úteis

### Gerenciar Serviços

```bash
# Parar tudo
docker stack rm reativa_bs_bot

# Reiniciar serviço
docker service update --force reativa_bs_bot_bot

# Escalar (mais réplicas)
docker service scale reativa_bs_bot_bot=3

# Ver logs de erro
docker service logs reativa_bs_bot_bot 2>&1 | grep ERROR
```

### Atualizar Sistema

```bash
# Pull nova versão
git pull origin claude/session-011CUYkxMVA3ozey5oRbJeFP

# Rebuild
docker build -t reativacao-bot:latest .

# Update (zero downtime)
docker service update --image reativacao-bot:latest reativa_bs_bot_bot
```

### Troubleshooting Rápido

```bash
# Serviço não inicia?
docker service ps reativa_bs_bot_bot --no-trunc

# Banco não conecta?
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d reativacao_vet

# Porta ocupada?
sudo lsof -i :3000

# Limpar tudo e recomeçar
docker stack rm reativa_bs_bot
docker system prune -a
./deploy_swarm.sh
```

## 📊 Cronograma de Jobs

| Horário | Job | Ação |
|---------|-----|------|
| 04:00 | VetCare Sync | Sincroniza dados |
| 08:00 | Consultas | Confirma agendamentos de amanhã |
| 09:30 | Vacinas | Lembretes de vacinas |
| 11:00 | Banho/Tosa | Reativação de banhos |
| 18:00 | Satisfação | Pesquisas pós-atendimento |

## 🆘 Suporte

**Problemas?** Consulte:

1. **Logs**: `docker service logs reativa_bs_bot_bot`
2. **Health**: `curl http://localhost:3000/health`
3. **Docs**:
   - [README.md](./README.md) - Documentação completa
   - [DEPLOY.md](./DEPLOY.md) - Deploy detalhado
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura
   - [API.md](./API.md) - Documentação da API

**Ainda com dúvidas?**
- Email: suporte@clinicabichosolto.com.br
- GitHub Issues: https://github.com/caioalcolea/reativa_bs_novo/issues

## 🎉 Pronto!

Seu sistema está rodando! Acesse:

- **Dashboard**: http://SEU_IP:3000/dashboard
- **Health Check**: http://SEU_IP:3000/health
- **API Stats**: http://SEU_IP:3000/api/dashboard/stats

---

**Sistema em produção em < 10 minutos!** ⚡

*Última atualização: Outubro 2025*
