#!/usr/bin/env python3
"""
VetCare Complete Sync Script
Importa dados completos da API VetCare com auto-criação de registros faltantes
"""

import os
import sys
import time
import requests
import psycopg2
from datetime import datetime
from typing import List, Dict, Any, Optional

# Configurações
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'bot_reativacao_vet'),
    'user': os.getenv('DB_USER', 'supabase_admin'),
    'password': os.getenv('DB_PASSWORD', ''),
}

API_BASE_URL = os.getenv('VETCARE_API_URL', 'https://vet.talkhub.me/api')
MAX_PETS = 6000  # Limite máximo de pets
RATE_LIMIT_MS = 150  # Delay entre requests (ms)

# Cores para output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(message):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(70)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")

def print_success(message):
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")

def normalize_phone(phone: str) -> Optional[str]:
    """Normaliza telefone para formato WhatsApp (5519999914201)"""
    if not phone:
        return None

    # Remove tudo que não é número
    cleaned = ''.join(filter(str.isdigit, phone))

    if not cleaned:
        return None

    # Se tem 10 ou 11 dígitos, adiciona +55
    if len(cleaned) == 10 or len(cleaned) == 11:
        cleaned = '55' + cleaned

    # Se tem 12 ou 13 dígitos e não começa com 55, adiciona
    if len(cleaned) in [12, 13] and not cleaned.startswith('55'):
        cleaned = '55' + cleaned

    return cleaned

class VetCareSync:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            'customers': {'synced': 0, 'errors': 0},
            'pets': {'synced': 0, 'errors': 0, 'limit_reached': False},
            'vaccines': {'synced': 0, 'errors': 0},
            'appointments': {'synced': 0, 'errors': 0, 'auto_created_customers': 0, 'auto_created_pets': 0},
            'grooming': {'synced': 0, 'errors': 0},
        }

    def connect_db(self):
        """Conecta ao banco de dados"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.conn.autocommit = False
            self.cursor = self.conn.cursor()
            print_success(f"Conectado ao banco: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        except Exception as e:
            print_error(f"Erro ao conectar ao banco: {e}")
            sys.exit(1)

    def close_db(self):
        """Fecha conexão com o banco"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        print_info("Conexão com banco fechada")

    def api_get(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        """Faz requisição GET na API VetCare com rate limiting"""
        try:
            url = f"{API_BASE_URL}{endpoint}"
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            time.sleep(RATE_LIMIT_MS / 1000)  # Rate limiting
            return response.json()
        except requests.exceptions.RequestException as e:
            print_error(f"Erro na API {endpoint}: {e}")
            return None

    def upsert_customer(self, customer_data: Dict) -> bool:
        """Insere ou atualiza cliente com normalização de telefone"""
        try:
            phone = normalize_phone(customer_data.get('telefone') or customer_data.get('whatsapp'))

            query = """
                INSERT INTO customers (id, name, phone, email, cpf, address, city, state, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    cpf = EXCLUDED.cpf,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    state = EXCLUDED.state,
                    updated_at = NOW()
            """

            # Montar endereço completo
            address_parts = []
            if customer_data.get('endereco'):
                address_parts.append(customer_data['endereco'])
            if customer_data.get('numero'):
                address_parts.append(customer_data['numero'])
            if customer_data.get('complemento'):
                address_parts.append(customer_data['complemento'])
            address = ', '.join(filter(None, address_parts)) if address_parts else None

            self.cursor.execute(query, (
                customer_data['id'],
                customer_data['nome'],
                phone,
                customer_data.get('email'),
                customer_data.get('cpf'),
                address,
                customer_data.get('cidade'),
                customer_data.get('estado'),
            ))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print_error(f"Erro ao upsert cliente {customer_data.get('id')}: {e}")
            return False

    def upsert_pet(self, pet_data: Dict) -> bool:
        """Insere ou atualiza pet"""
        try:
            customer_id = pet_data.get('cliente_id') or pet_data.get('cliente', {}).get('id')

            if not customer_id:
                print_warning(f"Pet {pet_data.get('id')} sem cliente_id - pulando")
                return False

            query = """
                INSERT INTO pets (id, name, species, breed, gender, birth_date, customer_id, weight, color, notes, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    species = EXCLUDED.species,
                    breed = EXCLUDED.breed,
                    gender = EXCLUDED.gender,
                    birth_date = EXCLUDED.birth_date,
                    customer_id = EXCLUDED.customer_id,
                    weight = EXCLUDED.weight,
                    color = EXCLUDED.color,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
            """

            self.cursor.execute(query, (
                pet_data['id'],
                pet_data['nome'],
                pet_data['especie'],
                pet_data.get('raca'),
                pet_data['sexo'],
                pet_data.get('data_nascimento'),
                customer_id,
                pet_data.get('peso'),
                pet_data.get('pelagem'),
                pet_data.get('observacoes'),
            ))
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print_error(f"Erro ao upsert pet {pet_data.get('id')}: {e}")
            return False

    def ensure_customer_exists(self, customer_data: Dict) -> bool:
        """Garante que cliente existe, criando se necessário"""
        try:
            # Verificar se cliente existe
            self.cursor.execute("SELECT id FROM customers WHERE id = %s", (customer_data['id'],))
            if self.cursor.fetchone():
                return True  # Já existe

            # Criar cliente
            phone = normalize_phone(customer_data.get('telefone') or customer_data.get('whatsapp'))

            query = """
                INSERT INTO customers (id, name, phone, email, created_at, updated_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
            """

            self.cursor.execute(query, (
                customer_data['id'],
                customer_data.get('nome', 'Cliente Auto-criado'),
                phone,
                customer_data.get('email'),
            ))
            self.conn.commit()
            self.stats['appointments']['auto_created_customers'] += 1
            print_warning(f"Cliente {customer_data['id']} auto-criado")
            return True
        except Exception as e:
            self.conn.rollback()
            print_error(f"Erro ao criar cliente {customer_data.get('id')}: {e}")
            return False

    def ensure_pet_exists(self, pet_data: Dict) -> bool:
        """Garante que pet existe, criando se necessário"""
        try:
            # Verificar se pet existe
            self.cursor.execute("SELECT id FROM pets WHERE id = %s", (pet_data['id'],))
            if self.cursor.fetchone():
                return True  # Já existe

            # Criar pet
            customer_id = pet_data.get('cliente_id')
            if not customer_id:
                return False

            query = """
                INSERT INTO pets (id, name, species, gender, customer_id, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            """

            self.cursor.execute(query, (
                pet_data['id'],
                pet_data.get('nome', 'Pet Auto-criado'),
                pet_data.get('especie', 'Cão'),
                pet_data.get('sexo', 'M'),
                customer_id,
            ))
            self.conn.commit()
            self.stats['appointments']['auto_created_pets'] += 1
            print_warning(f"Pet {pet_data['id']} auto-criado")
            return True
        except Exception as e:
            self.conn.rollback()
            print_error(f"Erro ao criar pet {pet_data.get('id')}: {e}")
            return False

    def sync_customers(self):
        """Sincroniza todos os clientes"""
        print_header("SINCRONIZANDO CLIENTES")

        data = self.api_get('/clientes')
        if not data or not isinstance(data, list):
            print_error("Erro ao buscar clientes da API")
            return

        print_info(f"Encontrados {len(data)} clientes")

        for i, customer in enumerate(data, 1):
            if self.upsert_customer(customer):
                self.stats['customers']['synced'] += 1
            else:
                self.stats['customers']['errors'] += 1

            if i % 100 == 0:
                print(f"\rProcessados: {i}/{len(data)} clientes", end='', flush=True)

        print()
        print_success(f"Clientes sincronizados: {self.stats['customers']['synced']} ✓, {self.stats['customers']['errors']} ✗")

    def sync_pets(self):
        """Sincroniza pets com limite de 6k e paginação"""
        print_header(f"SINCRONIZANDO PETS (limite: {MAX_PETS})")

        page = 1
        total_synced = 0
        seen_ids = set()

        while total_synced < MAX_PETS:
            print_info(f"Buscando página {page}...")
            data = self.api_get(f'/pets?page={page}')

            if not data:
                print_warning(f"Erro ao buscar página {page}")
                break

            # Extrair array de pets
            pets_data = data.get('data', data) if isinstance(data, dict) else data

            if not isinstance(pets_data, list) or len(pets_data) == 0:
                print_info("Sem mais pets para sincronizar")
                break

            # Detectar duplicatas (fim da paginação)
            duplicates = sum(1 for pet in pets_data if pet['id'] in seen_ids)
            if duplicates / len(pets_data) > 0.9:
                print_warning(f"Página {page} contém {duplicates}/{len(pets_data)} duplicatas - fim da paginação")
                break

            # Processar pets desta página
            for pet in pets_data:
                if total_synced >= MAX_PETS:
                    self.stats['pets']['limit_reached'] = True
                    print_warning(f"Limite de {MAX_PETS} pets atingido")
                    break

                if pet['id'] in seen_ids:
                    continue

                seen_ids.add(pet['id'])

                if self.upsert_pet(pet):
                    total_synced += 1
                    self.stats['pets']['synced'] += 1
                else:
                    self.stats['pets']['errors'] += 1

                if total_synced % 100 == 0:
                    print(f"\rProcessados: {total_synced}/{MAX_PETS} pets", end='', flush=True)

            if self.stats['pets']['limit_reached']:
                break

            page += 1
            time.sleep(0.2)  # Delay entre páginas

        print()
        print_success(f"Pets sincronizados: {self.stats['pets']['synced']} ✓, {self.stats['pets']['errors']} ✗")

    def sync_appointments(self):
        """Sincroniza agendamentos com auto-criação de clientes/pets"""
        print_header("SINCRONIZANDO AGENDAMENTOS (2022-2026)")

        page = 1
        total_synced = 0
        seen_ids = set()

        while True:
            print_info(f"Buscando página {page}...")
            data = self.api_get(f'/agendamentos?data_inicio=2022-01-01&data_fim=2026-12-31&page={page}')

            if not data:
                break

            appointments = data.get('data', data) if isinstance(data, dict) else data

            if not isinstance(appointments, list) or len(appointments) == 0:
                break

            # Detectar duplicatas
            duplicates = sum(1 for appt in appointments if appt['id'] in seen_ids)
            if duplicates / len(appointments) > 0.9:
                print_warning(f"Página {page} contém duplicatas - fim da paginação")
                break

            for appointment in appointments:
                if appointment['id'] in seen_ids:
                    continue

                seen_ids.add(appointment['id'])

                try:
                    # Garantir que cliente existe
                    if appointment.get('cliente'):
                        self.ensure_customer_exists(appointment['cliente'])

                    # Garantir que pet existe
                    if appointment.get('pet'):
                        pet_data = appointment['pet'].copy()
                        pet_data['cliente_id'] = appointment.get('cliente_id')
                        self.ensure_pet_exists(pet_data)

                    # Inserir agendamento
                    query = """
                        INSERT INTO appointments (id, pet_id, appointment_date, appointment_type, status, notes, amount, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            pet_id = EXCLUDED.pet_id,
                            appointment_date = EXCLUDED.appointment_date,
                            appointment_type = EXCLUDED.appointment_type,
                            status = EXCLUDED.status,
                            notes = EXCLUDED.notes,
                            amount = EXCLUDED.amount,
                            updated_at = NOW()
                    """

                    # Mapear tipo
                    appt_type = 'consulta'
                    tipo = (appointment.get('tipo') or '').lower()
                    if 'retorno' in tipo:
                        appt_type = 'retorno'
                    elif 'cirurgia' in tipo:
                        appt_type = 'cirurgia'
                    elif 'exame' in tipo:
                        appt_type = 'exame'

                    # Mapear status
                    status = 'agendado'
                    status_api = (appointment.get('status') or '').lower()
                    if 'confirmado' in status_api:
                        status = 'confirmado'
                    elif 'conclu' in status_api:
                        status = 'realizado'
                    elif 'cancelado' in status_api:
                        status = 'cancelado'

                    self.cursor.execute(query, (
                        appointment['id'],
                        appointment['pet_id'],
                        appointment['data_hora'],
                        appt_type,
                        status,
                        appointment.get('observacoes'),
                        appointment.get('valor'),
                    ))
                    self.conn.commit()
                    total_synced += 1
                    self.stats['appointments']['synced'] += 1

                    if total_synced % 100 == 0:
                        print(f"\rProcessados: {total_synced} agendamentos", end='', flush=True)

                except Exception as e:
                    self.conn.rollback()
                    self.stats['appointments']['errors'] += 1
                    print_error(f"Erro ao processar agendamento {appointment.get('id')}: {e}")

            page += 1
            time.sleep(0.2)

        print()
        print_success(f"Agendamentos sincronizados: {self.stats['appointments']['synced']} ✓, {self.stats['appointments']['errors']} ✗")
        if self.stats['appointments']['auto_created_customers'] > 0:
            print_warning(f"Clientes auto-criados: {self.stats['appointments']['auto_created_customers']}")
        if self.stats['appointments']['auto_created_pets'] > 0:
            print_warning(f"Pets auto-criados: {self.stats['appointments']['auto_created_pets']}")

    def run_full_sync(self):
        """Executa sincronização completa"""
        start_time = time.time()

        print_header("SINCRONIZAÇÃO COMPLETA VETCARE")
        print_info(f"API: {API_BASE_URL}")
        print_info(f"Database: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")
        print_info(f"Limite de pets: {MAX_PETS}")

        self.connect_db()

        try:
            self.sync_customers()
            self.sync_pets()
            self.sync_appointments()

            elapsed = time.time() - start_time

            print_header("SINCRONIZAÇÃO CONCLUÍDA")
            print_success(f"Tempo total: {elapsed:.2f}s")
            print_info(f"Clientes: {self.stats['customers']['synced']} ✓ | {self.stats['customers']['errors']} ✗")
            print_info(f"Pets: {self.stats['pets']['synced']} ✓ | {self.stats['pets']['errors']} ✗")
            print_info(f"Agendamentos: {self.stats['appointments']['synced']} ✓ | {self.stats['appointments']['errors']} ✗")

        except KeyboardInterrupt:
            print_warning("\nSincronização interrompida pelo usuário")
        except Exception as e:
            print_error(f"Erro durante sincronização: {e}")
        finally:
            self.close_db()

if __name__ == '__main__':
    sync = VetCareSync()
    sync.run_full_sync()
