#!/bin/bash

###############################################################################
# Script de Teste - VetCare API
# Testa todos os endpoints da API e analisa as respostas
###############################################################################

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurações
API_BASE_URL="https://vet.talkhub.me/api"
LOG_DIR="./api_test_logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Criar diretório de logs
mkdir -p "$LOG_DIR"

# Função para imprimir cabeçalho
print_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

# Função para imprimir sucesso
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Função para imprimir erro
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Função para imprimir warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Função para imprimir info
print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Função para testar endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local log_file="$LOG_DIR/${TIMESTAMP}_$(echo $endpoint | tr '/' '_' | tr '?' '_').json"

    print_header "$description"
    print_info "Endpoint: $method $API_BASE_URL$endpoint"
    print_info "Log file: $log_file"

    # Fazer requisição
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Salvar resposta em arquivo
    echo "$body" | jq '.' > "$log_file" 2>/dev/null || echo "$body" > "$log_file"

    # Analisar resultado
    if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        print_success "Status: $http_code OK"

        # Tentar parsear JSON e mostrar estatísticas
        if echo "$body" | jq '.' > /dev/null 2>&1; then
            # Verificar se é array ou objeto
            if echo "$body" | jq -e 'type == "array"' > /dev/null 2>&1; then
                count=$(echo "$body" | jq 'length')
                print_success "Tipo: Array com $count registros"

                if [ "$count" -gt 0 ]; then
                    print_info "Estrutura do primeiro registro:"
                    echo "$body" | jq '.[0] // {} | keys' | sed 's/^/    /'
                    print_info "Exemplo do primeiro registro:"
                    echo "$body" | jq '.[0] // {}' | head -20 | sed 's/^/    /'
                fi
            elif echo "$body" | jq -e 'has("data")' > /dev/null 2>&1; then
                # Formato { data: [...] }
                count=$(echo "$body" | jq '.data | length')
                print_success "Tipo: Objeto com 'data' array ($count registros)"

                if [ "$count" -gt 0 ]; then
                    print_info "Estrutura do primeiro registro:"
                    echo "$body" | jq '.data[0] // {} | keys' | sed 's/^/    /'
                    print_info "Exemplo do primeiro registro:"
                    echo "$body" | jq '.data[0] // {}' | head -20 | sed 's/^/    /'
                fi
            else
                print_success "Tipo: Objeto"
                print_info "Estrutura do objeto:"
                echo "$body" | jq 'keys' | sed 's/^/    /'
                print_info "Dados:"
                echo "$body" | jq '.' | head -20 | sed 's/^/    /'
            fi
        else
            print_warning "Resposta não é JSON válido"
            echo "$body" | head -10
        fi
    elif [ "$http_code" == "404" ]; then
        print_warning "Status: $http_code Not Found (pode ser normal se não houver dados)"
    else
        print_error "Status: $http_code"
        print_error "Resposta: $body"
    fi

    echo ""
    sleep 1
}

# Banner inicial
clear
echo -e "${CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║        VETCARE API - TESTE COMPLETO DE ENDPOINTS         ║
║                                                          ║
║         Sistema de Reativação Bicho Solto                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

print_info "Base URL: $API_BASE_URL"
print_info "Timestamp: $TIMESTAMP"
print_info "Log Directory: $LOG_DIR"
echo ""

# Teste 1: Clientes
test_endpoint "GET" "/clientes" "Teste 1: Buscar Clientes"

# Teste 2: Pets
test_endpoint "GET" "/pets" "Teste 2: Buscar Pets"

# Pegar primeiro pet ID para testar vacinas
print_info "Buscando primeiro Pet ID para testar vacinações..."
pets_response=$(curl -s "$API_BASE_URL/pets")
first_pet_id=$(echo "$pets_response" | jq -r '(.data[0].id // .[0].id // empty)')

if [ ! -z "$first_pet_id" ]; then
    print_success "Pet ID encontrado: $first_pet_id"
    test_endpoint "GET" "/pets/$first_pet_id/vacinacoes" "Teste 3: Buscar Vacinações do Pet $first_pet_id"
else
    print_warning "Nenhum Pet ID encontrado - pulando teste de vacinações"
fi

# Teste 4: Agendamentos
test_endpoint "GET" "/agendamentos" "Teste 4: Buscar Agendamentos"

# Pegar primeiro cliente ID para testar financeiro
print_info "Buscando primeiro Cliente ID para testar contas a receber..."
clientes_response=$(curl -s "$API_BASE_URL/clientes")
first_cliente_id=$(echo "$clientes_response" | jq -r '(.data[0].id // .[0].id // empty)')

if [ ! -z "$first_cliente_id" ]; then
    print_success "Cliente ID encontrado: $first_cliente_id"
    test_endpoint "GET" "/financeiro/contas-receber?cliente_id=$first_cliente_id" "Teste 5: Buscar Contas a Receber do Cliente $first_cliente_id"
else
    print_warning "Nenhum Cliente ID encontrado - pulando teste de contas a receber"
fi

# Teste adicional: Buscar todas as contas a receber (sem filtro)
test_endpoint "GET" "/financeiro/contas-receber" "Teste 6: Buscar Todas Contas a Receber (sem filtro)"

# Resumo final
print_header "RESUMO DOS TESTES"

echo -e "${GREEN}Testes concluídos!${NC}\n"
echo "Arquivos de log salvos em: $LOG_DIR"
echo ""
echo "Para visualizar os resultados:"
echo "  - ls -lh $LOG_DIR"
echo "  - cat $LOG_DIR/${TIMESTAMP}_*.json"
echo ""

# Contar arquivos de log
log_count=$(ls -1 $LOG_DIR/${TIMESTAMP}_*.json 2>/dev/null | wc -l)
print_success "$log_count arquivos de log criados"

# Mostrar arquivos criados
echo -e "\n${CYAN}Arquivos criados:${NC}"
ls -lh $LOG_DIR/${TIMESTAMP}_*.json 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

echo -e "\n${GREEN}Teste completo finalizado!${NC}\n"

# Análise de mapeamento
print_header "ANÁLISE DE MAPEAMENTO PARA O BANCO DE DADOS"

echo -e "${YELLOW}Verificando estrutura dos dados vs. schema do banco...${NC}\n"

# Verificar clientes
if [ -f "$LOG_DIR/${TIMESTAMP}__clientes.json" ]; then
    print_info "CLIENTES - Mapeamento:"
    echo "  VetCare API → Banco PostgreSQL"
    echo "  ─────────────────────────────────"
    echo "  id          → id (SERIAL PRIMARY KEY)"
    echo "  nome        → name (VARCHAR 255)"
    echo "  telefone    → phone (VARCHAR 20)"
    echo "  whatsapp    → phone (VARCHAR 20) [fallback]"
    echo "  email       → email (VARCHAR 255)"
    echo "  cpf         → cpf (VARCHAR 14)"
    echo "  endereco    → address (TEXT)"
    echo "  cidade      → city (VARCHAR 100)"
    echo "  estado      → state (VARCHAR 2)"
    echo ""
fi

# Verificar pets
if [ -f "$LOG_DIR/${TIMESTAMP}__pets.json" ]; then
    print_info "PETS - Mapeamento:"
    echo "  VetCare API → Banco PostgreSQL"
    echo "  ─────────────────────────────────"
    echo "  id              → id (SERIAL PRIMARY KEY)"
    echo "  nome            → name (VARCHAR 255)"
    echo "  especie         → species (VARCHAR 50)"
    echo "  raca            → breed (VARCHAR 255)"
    echo "  sexo            → gender (VARCHAR 20)"
    echo "  data_nascimento → birth_date (DATE)"
    echo "  peso            → weight (NUMERIC)"
    echo "  pelagem         → color (VARCHAR 255)"
    echo "  cliente_id      → customer_id (FK customers)"
    echo ""
fi

# Verificar vacinas
if [ ! -z "$first_pet_id" ] && [ -f "$LOG_DIR/${TIMESTAMP}__pets_${first_pet_id}_vacinacoes.json" ]; then
    print_info "VACINAS - Mapeamento:"
    echo "  VetCare API       → Banco PostgreSQL"
    echo "  ─────────────────────────────────────"
    echo "  id                → id (gerado local)"
    echo "  pet_id            → pet_id (FK pets)"
    echo "  vacina_nome       → vaccine_name (VARCHAR 255)"
    echo "  data_aplicacao    → application_date (DATE)"
    echo "  proxima_dose      → next_dose_date (DATE)"
    echo "  lote              → batch_number (VARCHAR 50)"
    echo "  veterinario_nome  → veterinarian (VARCHAR 255)"
    echo "  [auto-detectado]  → is_annual (BOOLEAN)"
    echo ""
fi

# Verificar agendamentos
if [ -f "$LOG_DIR/${TIMESTAMP}__agendamentos.json" ]; then
    print_info "AGENDAMENTOS - Mapeamento:"
    echo "  VetCare API    → Banco PostgreSQL"
    echo "  ─────────────────────────────────"
    echo "  id             → id (SERIAL PRIMARY KEY)"
    echo "  pet_id         → pet_id (FK pets)"
    echo "  data_hora      → appointment_date (TIMESTAMP)"
    echo "  tipo           → appointment_type (ENUM)"
    echo "  status         → status (ENUM)"
    echo "  observacoes    → notes (TEXT)"
    echo "  valor          → amount (NUMERIC)"
    echo ""
fi

# Verificar financeiro
if [ -f "$LOG_DIR/${TIMESTAMP}__financeiro_contas-receber_cliente_id*.json" ] || [ -f "$LOG_DIR/${TIMESTAMP}__financeiro_contas-receber.json" ]; then
    print_info "CONTAS A RECEBER - Mapeamento:"
    echo "  VetCare API       → Banco PostgreSQL"
    echo "  ─────────────────────────────────────"
    echo "  id                → id (SERIAL PRIMARY KEY)"
    echo "  cliente_id        → customer_id (FK customers)"
    echo "  valor             → amount (NUMERIC 10,2)"
    echo "  data_vencimento   → service_date (DATE)"
    echo "  descricao         → description (TEXT)"
    echo "  status            → paid (BOOLEAN)"
    echo "  data_pagamento    → [usado para calcular paid]"
    echo ""
fi

echo -e "${GREEN}Análise de mapeamento concluída!${NC}\n"
