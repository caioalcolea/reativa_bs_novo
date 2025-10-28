#!/usr/bin/env python3
"""
Database Cleanup Script
Limpa completamente o banco de dados do Bot de Reativação Veterinária
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from datetime import datetime

# Adicionar diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configurações do banco (ler de variáveis de ambiente)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'bot_reativacao_vet'),
    'user': os.getenv('DB_USER', 'supabase_admin'),
    'password': os.getenv('DB_PASSWORD', ''),
}

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
    UNDERLINE = '\033[4m'

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

def get_connection():
    """Conecta ao banco de dados PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        return conn
    except Exception as e:
        print_error(f"Erro ao conectar ao banco: {e}")
        sys.exit(1)

def get_table_counts(conn):
    """Retorna contagem de registros em cada tabela"""
    cursor = conn.cursor()

    tables = [
        'customers',
        'pets',
        'vaccines',
        'grooming_services',
        'appointments',
        'medical_history',
        'weight_history',
        'completed_services',
        'reactivation_logs',
    ]

    counts = {}
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]
        except:
            counts[table] = 0

    cursor.close()
    return counts

def drop_all_data(conn, confirm=True):
    """Remove todos os dados das tabelas"""
    cursor = conn.cursor()

    # Ordem de deleção (respeitando FKs)
    tables_order = [
        'reactivation_logs',
        'completed_services',
        'weight_history',
        'medical_history',
        'appointments',
        'grooming_services',
        'vaccines',
        'pets',
        'customers',
    ]

    print_header("LIMPEZA DE DADOS")

    # Mostrar contagens atuais
    print_info("Contagem atual de registros:")
    counts = get_table_counts(conn)
    total = sum(counts.values())

    for table, count in counts.items():
        if count > 0:
            print(f"  {table}: {Colors.WARNING}{count:,}{Colors.ENDC} registros")
        else:
            print(f"  {table}: {count} registros")

    print(f"\n{Colors.BOLD}Total: {total:,} registros{Colors.ENDC}\n")

    if total == 0:
        print_info("Banco de dados já está vazio!")
        return

    if confirm:
        print_warning("ATENÇÃO: Esta operação irá DELETAR TODOS OS DADOS!")
        response = input(f"{Colors.WARNING}Digite 'CONFIRMAR' para continuar: {Colors.ENDC}")
        if response != 'CONFIRMAR':
            print_error("Operação cancelada pelo usuário.")
            sys.exit(0)

    print()
    deleted_total = 0

    try:
        for table in tables_order:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]

            if count > 0:
                cursor.execute(f"TRUNCATE TABLE {table} CASCADE")
                print_success(f"Tabela '{table}': {count:,} registros deletados")
                deleted_total += count
            else:
                print_info(f"Tabela '{table}': já estava vazia")

        # Reset sequences
        print()
        print_info("Resetando sequences...")
        cursor.execute("""
            SELECT sequence_name FROM information_schema.sequences
            WHERE sequence_schema = 'public'
        """)
        sequences = cursor.fetchall()

        for (seq_name,) in sequences:
            cursor.execute(f"ALTER SEQUENCE {seq_name} RESTART WITH 1")
            print_success(f"Sequence '{seq_name}' resetada")

        conn.commit()
        print()
        print_success(f"Total de {deleted_total:,} registros deletados com sucesso!")

    except Exception as e:
        conn.rollback()
        print_error(f"Erro durante limpeza: {e}")
        sys.exit(1)
    finally:
        cursor.close()

def recreate_schema(conn):
    """Recria o schema do banco (DROP + CREATE)"""
    cursor = conn.cursor()

    print_header("RECRIAR SCHEMA COMPLETO")

    print_warning("ATENÇÃO: Esta operação irá DROPAR E RECRIAR todas as tabelas!")
    print_warning("Todos os dados serão PERMANENTEMENTE PERDIDOS!")
    response = input(f"{Colors.WARNING}Digite 'RECRIAR' para continuar: {Colors.ENDC}")
    if response != 'RECRIAR':
        print_error("Operação cancelada pelo usuário.")
        sys.exit(0)

    print()

    try:
        # Ler schema otimizado
        schema_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'database_schema_optimized.sql'
        )

        if not os.path.exists(schema_file):
            print_error(f"Arquivo de schema não encontrado: {schema_file}")
            sys.exit(1)

        print_info(f"Lendo schema de: {schema_file}")

        # Dropar tabelas existentes
        print_info("Dropando tabelas existentes...")

        tables = [
            'reactivation_logs',
            'completed_services',
            'weight_history',
            'medical_history',
            'appointments',
            'grooming_services',
            'grooming_plans',
            'vaccines',
            'pets',
            'customers',
        ]

        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            print_success(f"Tabela '{table}' dropada")

        # Dropar types
        print()
        print_info("Dropando tipos ENUM...")
        types = [
            'grooming_service_type',
            'grooming_plan_type',
            'appointment_type',
            'appointment_status',
            'reactivation_type',
            'reactivation_status',
        ]

        for type_name in types:
            cursor.execute(f"DROP TYPE IF EXISTS {type_name} CASCADE")
            print_success(f"Type '{type_name}' dropado")

        # Dropar views
        print()
        print_info("Dropando views...")
        cursor.execute("DROP VIEW IF EXISTS vw_customer_summary CASCADE")
        cursor.execute("DROP VIEW IF EXISTS vw_pets_with_stats CASCADE")
        print_success("Views dropadas")

        # Executar schema otimizado
        print()
        print_info("Executando schema otimizado...")

        with open(schema_file, 'r', encoding='utf-8') as f:
            schema_sql = f.read()

        cursor.execute(schema_sql)
        conn.commit()

        print_success("Schema otimizado criado com sucesso!")

        # Verificar tabelas criadas
        print()
        print_info("Verificando tabelas criadas:")
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)

        tables_created = cursor.fetchall()
        for (table_name,) in tables_created:
            print_success(f"✓ {table_name}")

        print()
        print_success(f"Total: {len(tables_created)} tabelas criadas")

    except Exception as e:
        conn.rollback()
        print_error(f"Erro ao recriar schema: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cursor.close()

def show_statistics(conn):
    """Mostra estatísticas do banco de dados"""
    cursor = conn.cursor()

    print_header("ESTATÍSTICAS DO BANCO DE DADOS")

    # Tamanho do banco
    cursor.execute("""
        SELECT pg_size_pretty(pg_database_size(current_database()))
    """)
    db_size = cursor.fetchone()[0]
    print_info(f"Tamanho do banco: {db_size}")

    print()

    # Contagem de tabelas
    counts = get_table_counts(conn)
    total = sum(counts.values())

    print_info("Registros por tabela:")
    for table, count in sorted(counts.items()):
        if count > 0:
            print(f"  {table}: {Colors.OKGREEN}{count:,}{Colors.ENDC} registros")
        else:
            print(f"  {table}: {count} registros")

    print()
    print_info(f"Total: {total:,} registros")

    # Tamanho por tabela
    print()
    print_info("Tamanho por tabela:")
    cursor.execute("""
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    """)

    for schema, table, size in cursor.fetchall():
        print(f"  {table}: {size}")

    cursor.close()

def main():
    """Função principal"""
    print_header("DATABASE CLEANUP TOOL")
    print_info(f"Database: {DB_CONFIG['database']}")
    print_info(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print_info(f"User: {DB_CONFIG['user']}")
    print()

    if len(sys.argv) < 2:
        print(f"{Colors.BOLD}Uso:{Colors.ENDC}")
        print(f"  python {sys.argv[0]} <comando> [opções]")
        print()
        print(f"{Colors.BOLD}Comandos disponíveis:{Colors.ENDC}")
        print(f"  stats              - Mostra estatísticas do banco")
        print(f"  clean              - Limpa todos os dados (com confirmação)")
        print(f"  clean --force      - Limpa todos os dados (sem confirmação)")
        print(f"  recreate           - Dropa e recria schema completo")
        print()
        sys.exit(1)

    command = sys.argv[1]

    # Conectar ao banco
    conn = get_connection()

    try:
        if command == 'stats':
            show_statistics(conn)

        elif command == 'clean':
            force = '--force' in sys.argv
            drop_all_data(conn, confirm=not force)
            print()
            show_statistics(conn)

        elif command == 'recreate':
            recreate_schema(conn)
            print()
            show_statistics(conn)

        else:
            print_error(f"Comando desconhecido: {command}")
            sys.exit(1)

    finally:
        conn.close()
        print()
        print_info("Conexão fechada.")

if __name__ == '__main__':
    main()
