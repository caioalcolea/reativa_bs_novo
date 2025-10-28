# Script de Sincronização Python

## Como usar o script `sync_vetcare_complete.py`

### Opção 1: Rodar no HOST (fora do Docker)

```bash
# 1. Configurar variáveis de ambiente
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=bot_reativacao_vet
export DB_USER=supabase_admin
export DB_PASSWORD=sua_senha_aqui

# 2. Executar
python3 scripts/sync_vetcare_complete.py
```

### Opção 2: Rodar DENTRO do container do bot

```bash
# 1. Entrar no container
docker exec -it $(docker ps -q -f name=bot-reativacao) bash

# 2. Rodar o script (variáveis já configuradas)
cd /app
python3 scripts/sync_vetcare_complete.py
```

### Opção 3: Rodar via docker exec (sem entrar no container)

```bash
docker exec $(docker ps -q -f name=bot-reativacao) python3 scripts/sync_vetcare_complete.py
```

## Configurações

### Limite de Pets
- **Atual**: 10.000 pets
- **Local**: Variável `MAX_PETS` no arquivo

### Normalização de Telefones
O script adiciona automaticamente o código `+55` se o telefone não tiver:
- `19999914201` → `5519999914201`
- `11987654321` → `5511987654321`

### Auto-criação
Se um agendamento referenciar:
- **Cliente inexistente**: cria automaticamente
- **Pet inexistente**: cria automaticamente

Isso previne erros de Foreign Key.

## Estatísticas

O script mostra no final:
```
====================================================================
                  SINCRONIZAÇÃO CONCLUÍDA
====================================================================
✓ Tempo total: 180.25s
ℹ Clientes: 5535 ✓ | 0 ✗
ℹ Pets: 5096 ✓ | 0 ✗
ℹ Agendamentos: 5600 ✓ | 0 ✗
⚠ Clientes auto-criados: 15
⚠ Pets auto-criados: 8
```

## Troubleshooting

### Erro: "could not translate host name"

**Problema**: Está tentando usar `tasks.postgres_postgres` fora do Docker Swarm.

**Solução**: Configure `DB_HOST=localhost` antes de rodar:
```bash
export DB_HOST=localhost
python3 scripts/sync_vetcare_complete.py
```

### Erro: "connection refused"

**Problema**: PostgreSQL não está exposto na porta 5432 do host.

**Solução**: Use docker exec para rodar dentro do container:
```bash
docker exec $(docker ps -q -f name=bot-reativacao) python3 scripts/sync_vetcare_complete.py
```

### Verificar conexão

Para testar se consegue conectar no banco:
```bash
# Do host
psql -h localhost -p 5432 -U supabase_admin -d bot_reativacao_vet

# Ou via Docker
docker exec -it postgres_postgres.1.$(docker ps -q -f name=postgres_postgres) \
  psql -U supabase_admin -d bot_reativacao_vet
```
