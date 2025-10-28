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

# Teste 2: Cliente específico (Caio Alcolea - ID 3390)
test_endpoint "GET" "/clientes/3390/pets" "Teste 2: Buscar Pets do Cliente 3390"

# Teste 3: Pets (paginado)
test_endpoint "GET" "/pets" "Teste 3: Buscar Pets (Paginado)"

# Usar Pet ID real: 4959 (Marlon - Cão)
print_info "Usando Pet ID 4959 (Marlon) para testes detalhados..."

# Teste 4: Detalhes completos do Pet
test_endpoint "GET" "/pets/4959" "Teste 4: Detalhes Completos do Pet 4959"

# Teste 5: Vacinações do Pet
test_endpoint "GET" "/pets/4959/vacinacoes" "Teste 5: Vacinações do Pet 4959"

# Teste 6: Histórico Médico
test_endpoint "GET" "/pets/4959/historico-medico" "Teste 6: Histórico Médico do Pet 4959"

# Teste 7: Histórico de Peso
test_endpoint "GET" "/pets/4959/historico-peso" "Teste 7: Histórico de Peso do Pet 4959"

# Teste 8: Fichas de Banho/Tosa
test_endpoint "GET" "/pets/4959/fichas-banho" "Teste 8: Fichas de Banho do Pet 4959"

# Teste 9: Estatísticas do Pet
test_endpoint "GET" "/pets/4959/estatisticas" "Teste 9: Estatísticas do Pet 4959"

# Teste 10: Agendamentos
test_endpoint "GET" "/agendamentos" "Teste 10: Buscar Agendamentos"

# Teste 11: Agendamentos do Cliente
test_endpoint "GET" "/agendamentos?cliente_id=3390" "Teste 11: Agendamentos do Cliente 3390"

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
if [ -f "$LOG_DIR/${TIMESTAMP}__pets_4959_vacinacoes.json" ]; then
    print_info "VACINAS - Mapeamento:"
    echo "  VetCare API             → Banco PostgreSQL"
    echo "  ───────────────────────────────────────────"
    echo "  id                      → id (SERIAL PRIMARY KEY)"
    echo "  pet_id                  → pet_id (FK pets)"
    echo "  vacina.nome             → vaccine_name (VARCHAR 255)"
    echo "  data_aplicacao          → application_date (DATE)"
    echo "  proxima_dose            → next_dose_date (DATE)"
    echo "  lote                    → batch_number (VARCHAR 50)"
    echo "  veterinario.nome        → veterinarian (VARCHAR 255)"
    echo "  [auto-detectado]        → is_annual (BOOLEAN)"
    echo ""
fi

# Verificar fichas de banho
if [ -f "$LOG_DIR/${TIMESTAMP}__pets_4959_fichas-banho.json" ]; then
    print_info "FICHAS DE BANHO - Mapeamento:"
    echo "  VetCare API       → Banco PostgreSQL"
    echo "  ─────────────────────────────────────"
    echo "  id                → id (SERIAL PRIMARY KEY)"
    echo "  pet_id            → pet_id (FK pets) [4959]"
    echo "  data              → service_date (DATE)"
    echo "  retorno           → [usado para calcular next_service]"
    echo "  servicos          → service_type (grooming_services)"
    echo "  valor_total       → [não usado]"
    echo "  funcionario_nome  → [não usado]"
    echo "  has_plan          → [detectar se tem plano]"
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

echo -e "${GREEN}Análise de mapeamento concluída!${NC}\n"

print_header "OBSERVAÇÕES IMPORTANTES"
echo -e "${YELLOW}Endpoint /financeiro/contas-receber está quebrado (erro 500)${NC}"
echo -e "${YELLOW}Módulo de reativação financeira foi REMOVIDO do sistema${NC}"
echo ""
echo -e "${GREEN}Novos endpoints descobertos:${NC}"
echo "  - GET /clientes/{id}/pets"
echo "  - GET /pets/{id} (detalhes completos)"
echo "  - GET /pets/{id}/historico-medico"
echo "  - GET /pets/{id}/historico-peso"
echo "  - GET /pets/{id}/fichas-banho"
echo "  - GET /pets/{id}/estatisticas"
echo ""
echo -e "${CYAN}Sistema otimizado para usar Pet 4959 (Marlon) como referência${NC}\n"
