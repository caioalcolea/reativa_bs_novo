#!/usr/bin/env python3
"""
Database Import Script
Importa dados da API VetCare para o banco de dados local
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

def print_progress(current, total, entity):
    percent = (current / total * 100) if total > 0 else 0
    bar_length = 40
    filled = int(bar_length * current // total) if total > 0 else 0
    bar = '█' * filled + '░' * (bar_length - filled)
    print(f"\r{Colors.OKCYAN}[{bar}] {percent:6.2f}% ({current}/{total}) {entity}{Colors.ENDC}", end='', flush=True)

class VetCareImporter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.stats = {
            'customers': {'synced': 0, 'errors': 0},
            'pets': {'synced': 0, 'errors': 0},
            'vaccines': {'synced': 0, 'errors': 0},
            'grooming': {'synced': 0, 'errors': 0},
            'appointments': {'synced': 0, 'errors': 0},
        }

    def connect_db(self):
        """Conecta ao banco de dados"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.conn.autocommit = False
            self.cursor = self.conn.cursor()
            print_success("Conectado ao banco de dados")
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
        """Faz requisição GET na API VetCare"""
        try:
            url = f"{API_BASE_URL}{endpoint}"
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print_error(f"Erro na API {endpoint}: {e}")
            return None

    def parse_date(self, date_str: str, format: str = '%Y-%m-%d') -> Optional[str]:
        """Parseia data em diversos formatos"""
        if not date_str:
            return None

        # Tentar formato DD/MM/YYYY
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                day, month, year = parts
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

        # Já está em formato YYYY-MM-DD
        if '-' in date_str:
            return date_str.split(' ')[0]  # Remove parte de hora se houver

        return None

    def import_customers(self):
        """Importa clientes"""
        print_header("IMPORTANDO CLIENTES")

        data = self.api_get('/clientes')
        if not data or not isinstance(data, list):
            print_error("Erro ao buscar clientes")
            return

        total = len(data)
        print_info(f"Total de clientes a importar: {total:,}")
        print()

        for i, customer in enumerate(data, 1):
            try:
                self.cursor.execute("""
                    INSERT INTO customers (
                        id, name, phone, whatsapp, email, cpf, rg,
                        address, numero, complemento, bairro, city, state, cep,
                        data_nascimento, observacoes, saldo_devedor, ativo
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        phone = EXCLUDED.phone,
                        whatsapp = EXCLUDED.whatsapp,
                        email = EXCLUDED.email,
                        cpf = EXCLUDED.cpf,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        updated_at = NOW()
                """, (
                    customer.get('id'),
                    customer.get('nome'),
                    customer.get('telefone'),
                    customer.get('whatsapp'),
                    customer.get('email'),
                    customer.get('cpf'),
                    customer.get('rg'),
                    customer.get('endereco'),
                    customer.get('numero'),
                    customer.get('complemento'),
                    customer.get('bairro'),
                    customer.get('cidade'),
                    customer.get('estado'),
                    customer.get('cep'),
                    self.parse_date(customer.get('data_nascimento')) if customer.get('data_nascimento') else None,
                    customer.get('observacoes'),
                    customer.get('saldo_devedor', 0),
                    customer.get('ativo', True),
                ))

                self.stats['customers']['synced'] += 1

                if i % 100 == 0:
                    self.conn.commit()
                    print_progress(i, total, 'clientes')

            except Exception as e:
                print_error(f"\nErro ao importar cliente {customer.get('id')}: {e}")
                self.stats['customers']['errors'] += 1

        self.conn.commit()
        print_progress(total, total, 'clientes')
        print()
        print_success(f"Clientes importados: {self.stats['customers']['synced']:,}")
        if self.stats['customers']['errors'] > 0:
            print_warning(f"Erros: {self.stats['customers']['errors']}")

    def import_pets(self):
        """Importa pets"""
        print_header("IMPORTANDO PETS")

        data = self.api_get('/pets')
        if not data:
            print_error("Erro ao buscar pets")
            return

        # API retorna { data: [...] }
        pets_data = data.get('data', []) if isinstance(data, dict) else data

        if not isinstance(pets_data, list):
            print_error("Formato de dados inválido")
            return

        total = len(pets_data)
        print_info(f"Total de pets a importar: {total:,}")
        print()

        for i, pet in enumerate(pets_data, 1):
            try:
                cliente_id = pet.get('cliente_id') or pet.get('cliente', {}).get('id')

                if not cliente_id:
                    self.stats['pets']['errors'] += 1
                    continue

                self.cursor.execute("""
                    INSERT INTO pets (
                        id, customer_id, name, species, breed, gender, castrado,
                        birth_date, weight, color, microchip, foto, alergias,
                        observacoes, ativo
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        species = EXCLUDED.species,
                        breed = EXCLUDED.breed,
                        weight = EXCLUDED.weight,
                        updated_at = NOW()
                """, (
                    pet.get('id'),
                    cliente_id,
                    pet.get('nome'),
                    pet.get('especie'),
                    pet.get('raca'),
                    pet.get('sexo'),
                    pet.get('castrado', False),
                    self.parse_date(pet.get('data_nascimento')) if pet.get('data_nascimento') else None,
                    pet.get('peso'),
                    pet.get('pelagem'),
                    pet.get('microchip'),
                    pet.get('foto'),
                    pet.get('alergias'),
                    pet.get('observacoes'),
                    pet.get('ativo', True),
                ))

                self.stats['pets']['synced'] += 1

                if i % 50 == 0:
                    self.conn.commit()
                    print_progress(i, total, 'pets')

            except Exception as e:
                print_error(f"\nErro ao importar pet {pet.get('id')}: {e}")
                self.stats['pets']['errors'] += 1

        self.conn.commit()
        print_progress(total, total, 'pets')
        print()
        print_success(f"Pets importados: {self.stats['pets']['synced']:,}")
        if self.stats['pets']['errors'] > 0:
            print_warning(f"Erros: {self.stats['pets']['errors']}")

    def import_vaccines(self):
        """Importa vacinas de todos os pets"""
        print_header("IMPORTANDO VACINAS")

        # Buscar pets do banco
        self.cursor.execute("SELECT id FROM pets")
        pet_ids = [row[0] for row in self.cursor.fetchall()]

        total = len(pet_ids)
        print_info(f"Importando vacinas de {total:,} pets")
        print()

        vaccines_imported = 0
        vaccines_errors = 0

        for i, pet_id in enumerate(pet_ids, 1):
            try:
                data = self.api_get(f'/pets/{pet_id}/vacinacoes')

                if not data or not isinstance(data, list):
                    continue

                for vaccine in data:
                    try:
                        vaccine_name = vaccine.get('vacina', {}).get('nome') or vaccine.get('vacina_nome')
                        vet_name = vaccine.get('veterinario', {}).get('nome') or vaccine.get('veterinario_nome')

                        if not vaccine_name:
                            continue

                        # Detectar vacina anual
                        is_annual = any(term in vaccine_name.lower() for term in [
                            'anual', 'raiva', 'v8', 'v10', 'múltipla', 'multipla'
                        ])

                        self.cursor.execute("""
                            INSERT INTO vaccines (
                                pet_id, vacina_id, vaccine_name, veterinarian_id, veterinarian_name,
                                application_date, next_dose_date, dose, batch_number, is_annual, observacoes
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (pet_id, vaccine_name, application_date) DO UPDATE SET
                                next_dose_date = EXCLUDED.next_dose_date,
                                updated_at = NOW()
                        """, (
                            pet_id,
                            vaccine.get('vacina_id'),
                            vaccine_name,
                            vaccine.get('veterinario_id'),
                            vet_name,
                            vaccine.get('data_aplicacao'),
                            vaccine.get('proxima_dose') or vaccine.get('data_proxima_dose'),
                            vaccine.get('dose'),
                            vaccine.get('lote'),
                            is_annual,
                            vaccine.get('observacoes'),
                        ))

                        vaccines_imported += 1

                    except Exception as e:
                        vaccines_errors += 1

                if i % 10 == 0:
                    self.conn.commit()
                    print_progress(i, total, 'pets processados')

                time.sleep(0.1)  # Rate limiting

            except Exception as e:
                continue

        self.conn.commit()
        print_progress(total, total, 'pets processados')
        print()
        print_success(f"Vacinas importadas: {vaccines_imported:,}")
        if vaccines_errors > 0:
            print_warning(f"Erros: {vaccines_errors}")

        self.stats['vaccines']['synced'] = vaccines_imported
        self.stats['vaccines']['errors'] = vaccines_errors

    def import_grooming(self):
        """Importa fichas de banho de todos os pets"""
        print_header("IMPORTANDO FICHAS DE BANHO")

        # Buscar pets do banco
        self.cursor.execute("SELECT id FROM pets")
        pet_ids = [row[0] for row in self.cursor.fetchall()]

        total = len(pet_ids)
        print_info(f"Importando fichas de banho de {total:,} pets")
        print()

        grooming_imported = 0
        grooming_errors = 0

        for i, pet_id in enumerate(pet_ids, 1):
            try:
                data = self.api_get(f'/pets/{pet_id}/fichas-banho')

                if not data or not isinstance(data, list):
                    continue

                for record in data:
                    try:
                        service_date = self.parse_date(record.get('data'))
                        retorno_date = self.parse_date(record.get('retorno')) if record.get('retorno') else None

                        # Detectar tipo de serviço
                        servicos = record.get('servicos', '').lower()
                        if 'tosa' in servicos and 'banho' in servicos:
                            service_type = 'banho_tosa'
                        elif 'tosa' in servicos:
                            service_type = 'tosa'
                        else:
                            service_type = 'banho'

                        self.cursor.execute("""
                            INSERT INTO grooming_services (
                                ficha_id, pet_id, service_date, retorno_date, service_type,
                                servicos_detalhes, valor_total, funcionario_nome, observacoes
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (pet_id, service_date) DO UPDATE SET
                                service_type = EXCLUDED.service_type,
                                updated_at = NOW()
                        """, (
                            record.get('id'),
                            pet_id,
                            service_date,
                            retorno_date,
                            service_type,
                            record.get('servicos'),
                            float(record.get('valor_total', 0)),
                            record.get('funcionario_nome'),
                            record.get('observacoes'),
                        ))

                        grooming_imported += 1

                    except Exception as e:
                        grooming_errors += 1

                if i % 10 == 0:
                    self.conn.commit()
                    print_progress(i, total, 'pets processados')

                time.sleep(0.1)  # Rate limiting

            except Exception as e:
                continue

        self.conn.commit()
        print_progress(total, total, 'pets processados')
        print()
        print_success(f"Fichas de banho importadas: {grooming_imported:,}")
        if grooming_errors > 0:
            print_warning(f"Erros: {grooming_errors}")

        self.stats['grooming']['synced'] = grooming_imported
        self.stats['grooming']['errors'] = grooming_errors

    def import_appointments(self):
        """Importa agendamentos"""
        print_header("IMPORTANDO AGENDAMENTOS")

        data = self.api_get('/agendamentos')
        if not data or not isinstance(data, list):
            print_error("Erro ao buscar agendamentos")
            return

        total = len(data)
        print_info(f"Total de agendamentos a importar: {total:,}")
        print()

        for i, appt in enumerate(data, 1):
            try:
                # Mapear tipo
                tipo = appt.get('tipo', '').lower()
                if 'retorno' in tipo:
                    appt_type = 'retorno'
                elif 'cirurgia' in tipo:
                    appt_type = 'cirurgia'
                elif 'exame' in tipo:
                    appt_type = 'exame'
                elif 'vacina' in tipo:
                    appt_type = 'vacina'
                elif 'banho' in tipo or 'tosa' in tipo:
                    appt_type = 'banho_tosa'
                else:
                    appt_type = 'consulta'

                # Mapear status
                status = appt.get('status', '').lower()
                if 'confirmado' in status:
                    status = 'confirmado'
                elif 'cancelado' in status:
                    status = 'cancelado'
                elif 'conclu' in status or 'realizado' in status:
                    status = 'concluido'
                else:
                    status = 'agendado'

                self.cursor.execute("""
                    INSERT INTO appointments (
                        id, cliente_id, pet_id, servico_id, veterinario_id,
                        appointment_date, appointment_type, status, duracao_minutos,
                        amount, observacoes, lembrete_enviado
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        updated_at = NOW()
                """, (
                    appt.get('id'),
                    appt.get('cliente_id'),
                    appt.get('pet_id'),
                    appt.get('servico_id'),
                    appt.get('veterinario_id'),
                    appt.get('data_hora'),
                    appt_type,
                    status,
                    appt.get('duracao_minutos'),
                    float(appt.get('valor', 0)) if appt.get('valor') else None,
                    appt.get('observacoes'),
                    appt.get('lembrete_enviado', False),
                ))

                self.stats['appointments']['synced'] += 1

                if i % 100 == 0:
                    self.conn.commit()
                    print_progress(i, total, 'agendamentos')

            except Exception as e:
                print_error(f"\nErro ao importar agendamento {appt.get('id')}: {e}")
                self.stats['appointments']['errors'] += 1

        self.conn.commit()
        print_progress(total, total, 'agendamentos')
        print()
        print_success(f"Agendamentos importados: {self.stats['appointments']['synced']:,}")
        if self.stats['appointments']['errors'] > 0:
            print_warning(f"Erros: {self.stats['appointments']['errors']}")

    def show_summary(self):
        """Mostra resumo da importação"""
        print_header("RESUMO DA IMPORTAÇÃO")

        total_synced = sum(s['synced'] for s in self.stats.values())
        total_errors = sum(s['errors'] for s in self.stats.values())

        for entity, stats in self.stats.items():
            if stats['synced'] > 0 or stats['errors'] > 0:
                print(f"  {entity.capitalize():15} - "
                      f"{Colors.OKGREEN}{stats['synced']:,} importados{Colors.ENDC}, "
                      f"{Colors.FAIL if stats['errors'] > 0 else Colors.OKGREEN}{stats['errors']} erros{Colors.ENDC}")

        print()
        print(f"{Colors.BOLD}Total: {total_synced:,} registros importados, {total_errors} erros{Colors.ENDC}")

    def run(self):
        """Executa importação completa"""
        start_time = time.time()

        print_header("IMPORTAÇÃO COMPLETA DA API VETCARE")
        print_info(f"API Base URL: {API_BASE_URL}")
        print_info(f"Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}")
        print()

        self.connect_db()

        try:
            self.import_customers()
            self.import_pets()
            self.import_vaccines()
            self.import_grooming()
            self.import_appointments()

            elapsed = time.time() - start_time
            print()
            print_info(f"Tempo total: {elapsed:.2f} segundos")

            self.show_summary()

        except Exception as e:
            print_error(f"Erro durante importação: {e}")
            import traceback
            traceback.print_exc()
            self.conn.rollback()
        finally:
            self.close_db()

if __name__ == '__main__':
    importer = VetCareImporter()
    importer.run()
