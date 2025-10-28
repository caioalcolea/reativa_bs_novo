# Scripts de Gerenciamento do Banco de Dados

Ferramentas para gerenciar o banco de dados do Bot de Reativação Veterinária.

## 📋 Pré-requisitos

```bash
# Instalar dependências Python
pip install psycopg2-binary requests python-dotenv

# Ou usando requirements
pip install -r requirements.txt
```

## 🔧 Configuração

As variáveis de ambiente podem ser configuradas via:

1. **Arquivo `.env`** na raiz do projeto:
```env
DB_HOST=postgres_postgres.1.byodefogahamy9w9gwfvvsxdg
DB_PORT=5432
DB_NAME=bot_reativacao_vet
DB_USER=supabase_admin
DB_PASSWORD=sua_senha_aqui
VETCARE_API_URL=https://vet.talkhub.me/api
```

2. **Export manual**:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=bot_reativacao_vet
export DB_USER=supabase_admin
export DB_PASSWORD=sua_senha
```

## 🗂️ Arquivos Disponíveis

### `db_cleanup.py`
Script de limpeza e reset do banco de dados.

**Comandos:**

```bash
# Ver estatísticas do banco (sem modificar nada)
python scripts/db_cleanup.py stats

# Limpar todos os dados (com confirmação)
python scripts/db_cleanup.py clean

# Limpar todos os dados (sem confirmação - CUIDADO!)
python scripts/db_cleanup.py clean --force

# Dropar e recriar schema completo (DESTRUTIVO!)
python scripts/db_cleanup.py recreate
```

**Exemplo de saída:**

```
========================================
         ESTATÍSTICAS DO BANCO
========================================

ℹ Tamanho do banco: 15 MB

ℹ Registros por tabela:
  customers: 5,535 registros
  pets: 3,245 registros
  vaccines: 1,234 registros
  ...

ℹ Total: 10,014 registros
```

### `db_import.py`
Script de importação inicial de dados da API VetCare.

**Uso:**

```bash
# Importação completa
python scripts/db_import.py
```

**O que faz:**
1. ✅ Importa todos os clientes (`/clientes`)
2. ✅ Importa todos os pets (`/pets`)
3. ✅ Importa vacinas de cada pet (`/pets/{id}/vacinacoes`)
4. ✅ Importa fichas de banho (`/pets/{id}/fichas-banho`)
5. ✅ Importa agendamentos (`/agendamentos`)

**Recursos:**
- ⚡ Barra de progresso em tempo real
- 🔄 Rate limiting (100ms entre pets)
- 🛡️ Proteção contra duplicatas (UPSERT)
- 📊 Estatísticas detalhadas ao final
- ❌ Tratamento de erros individual

## 🚀 Fluxo Completo de Reinstalação

### Opção 1: Reset Completo (Recomendado)

```bash
# 1. Dropar e recriar schema
python scripts/db_cleanup.py recreate

# 2. Importar dados da API
python scripts/db_import.py

# 3. Verificar estatísticas
python scripts/db_cleanup.py stats
```

### Opção 2: Limpeza Apenas de Dados

```bash
# 1. Limpar dados mantendo schema
python scripts/db_cleanup.py clean

# 2. Importar dados
python scripts/db_import.py
```

### Opção 3: Importação Incremental

```bash
# Apenas importar (sem limpar)
# ATENÇÃO: Vai fazer UPSERT (atualizar existentes)
python scripts/db_import.py
```

## 📝 Exemplo Completo

```bash
# Conectar ao servidor VPS
ssh root@talkhub

# Navegar para diretório
cd ~/mcp_bs_novo/bot_reativacao

# Configurar variáveis
export DB_HOST=postgres_postgres.1.byodefogahamy9w9gwfvvsxdg
export DB_PORT=5432
export DB_NAME=bot_reativacao_vet
export DB_USER=supabase_admin
export DB_PASSWORD=sua_senha

# Ver estado atual
python scripts/db_cleanup.py stats

# Recriar banco do zero
python scripts/db_cleanup.py recreate

# Importar todos os dados
python scripts/db_import.py

# Verificar resultado
python scripts/db_cleanup.py stats
```

## ⚠️ Avisos Importantes

### ⚠️ `db_cleanup.py clean`
- **Deleta TODOS os dados** das tabelas
- **Reseta sequences** para começar do 1
- **Mantém o schema** (estrutura das tabelas)
- **Pede confirmação** (digite `CONFIRMAR`)

### 🔴 `db_cleanup.py recreate`
- **DROPA TODAS AS TABELAS**
- **Recria do zero** usando `database_schema_optimized.sql`
- **PERDA PERMANENTE DE DADOS**
- **Pede confirmação** (digite `RECRIAR`)

### ✅ `db_import.py`
- **Safe**: Usa UPSERT (INSERT ... ON CONFLICT DO UPDATE)
- **Não deleta** dados existentes
- **Atualiza** registros existentes
- **Adiciona** novos registros

## 🛠️ Troubleshooting

### Erro: "Conexão recusada"

```bash
# Verificar se PostgreSQL está rodando
docker service ls | grep postgres

# Verificar variáveis
echo $DB_HOST
echo $DB_PORT
```

### Erro: "Tabela não existe"

```bash
# Recriar schema
python scripts/db_cleanup.py recreate
```

### Erro: "API timeout"

```bash
# Aumentar timeout no script (linha ~20 de db_import.py)
# Ou rodar novamente - script tem proteção contra duplicatas
```

### Verificar dados importados

```bash
# Usar psql direto
docker exec -it postgres_postgres.1.xxx psql -U supabase_admin -d bot_reativacao_vet

# Dentro do psql:
\dt                    # Listar tabelas
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM pets;
SELECT COUNT(*) FROM vaccines;
```

## 📊 Tempo Estimado

| Operação | Tempo Estimado |
|----------|----------------|
| `cleanup stats` | < 1 segundo |
| `cleanup clean` | 1-5 segundos |
| `cleanup recreate` | 5-10 segundos |
| `import` (5535 clientes) | 2-5 minutos |

## 🔒 Segurança

- ✅ **Nunca commitar** `.env` com senhas
- ✅ **Fazer backup** antes de `recreate`
- ✅ **Testar em development** antes de production
- ✅ **Usar `stats`** antes de operações destrutivas

## 📞 Suporte

Em caso de problemas:

1. Verificar logs: `python script.py 2>&1 | tee import.log`
2. Ver tabelas: `python scripts/db_cleanup.py stats`
3. Consultar README principal do projeto
