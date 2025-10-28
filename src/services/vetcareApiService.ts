import axios, { AxiosInstance } from 'axios';
import { database } from '../config/database';
import { logger } from '../utils/logger';

interface VetCareConfig {
  apiUrl: string;
}

// Tipos baseados na documentação real da API
interface VetCareCliente {
  id: number;
  nome: string;
  cpf?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  ativo?: boolean;
}

interface VetCarePet {
  id: number;
  nome: string;
  especie: string;
  raca?: string;
  sexo: string;
  data_nascimento?: string;
  peso?: number;
  castrado?: boolean;
  pelagem?: string;
  microchip?: string;
  alergias?: string;
  observacoes?: string;
  cliente_id?: number;
  ativo?: boolean;
}

// Sub-interfaces para objetos aninhados
interface VetCareVacina {
  id: number;
  nome: string;
  fabricante?: string;
  tipo?: string;
  descricao?: string;
  preco?: string;
  ativo?: boolean;
}

interface VetCareVeterinario {
  id: number;
  nome: string;
  email?: string;
  crmv?: string;
  especialidade?: string;
  telefone?: string;
}

interface VetCareVacinacao {
  id: number;
  pet_id?: number;
  vacina_id?: number;
  veterinario_id?: number;
  data_aplicacao: string;
  proxima_dose?: string;
  data_proxima_dose?: string;  // Campo alternativo
  dose?: string;
  lote?: string;
  observacoes?: string;  // Campo que faltava
  created_at?: string;
  updated_at?: string;
  // Campos alternativos (quando não vem objeto aninhado)
  vacina_nome?: string;
  veterinario_nome?: string;
  // Objetos aninhados (quando vem completo)
  vacina?: VetCareVacina;
  veterinario?: VetCareVeterinario;
}

interface VetCareAgendamento {
  id: number;
  cliente_id: number;
  pet_id: number;
  data_hora: string;
  tipo: string;
  status: string;
  veterinario_id?: number;
  valor?: number;
  observacoes?: string;
}

interface VetCareContaReceber {
  id: number;
  cliente_id: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  descricao?: string;
  status: string;
}

interface VetCareFichaBanho {
  id: number;
  data: string;
  retorno?: string;
  servicos: string;
  produtos_extras?: string;
  valor_total: string;
  observacoes?: string;
  funcionario_nome?: string;
}

export class VetCareApiService {
  private client: AxiosInstance;
  private config: VetCareConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.VETCARE_API_URL || 'https://vet.talkhub.me/api',
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info(`VetCare API configurada: ${this.config.apiUrl}`);
  }

  /**
   * Trata erros de requisição HTTP de forma padronizada
   */
  private logRequestError(error: any, endpoint: string): void {
    if (error.response) {
      logger.error(`Erro HTTP ${error.response.status} ao acessar ${endpoint}:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: typeof error.response.data === 'string'
          ? error.response.data.substring(0, 200)
          : error.response.data
      });
    } else if (error.request) {
      logger.error(`Sem resposta da API ao acessar ${endpoint}:`, {
        message: error.message,
        code: error.code,
        url: `${this.config.apiUrl}${endpoint}`
      });
    } else {
      logger.error(`Erro ao configurar requisição para ${endpoint}:`, error.message);
    }
  }

  /**
   * Sincroniza todos os clientes do VetCare
   */
  async syncCustomers(): Promise<{ synced: number; errors: number }> {
    logger.info('Iniciando sincronização de clientes do VetCare');

    try {
      logger.info(`GET ${this.config.apiUrl}/clientes`);
      const response = await this.client.get<VetCareCliente[]>('/clientes');
      const customers = response.data;

      if (!Array.isArray(customers)) {
        logger.error('Resposta da API não é um array:', typeof customers);
        return { synced: 0, errors: 1 };
      }

      logger.info(`API retornou ${customers.length} clientes`);

      let synced = 0;
      let errors = 0;

      for (const customer of customers) {
        try {
          // Verificar se cliente já existe
          const existing = await database.query(
            'SELECT id FROM customers WHERE id = $1',
            [customer.id]
          );

          if (existing.length > 0) {
            // Atualizar cliente existente
            await database.query(
              `UPDATE customers
               SET name = $1, phone = $2, email = $3, cpf = $4,
                   address = $5, city = $6, state = $7, updated_at = NOW()
               WHERE id = $8`,
              [
                customer.nome,
                customer.telefone || customer.whatsapp || null,
                customer.email || null,
                customer.cpf || null,
                customer.endereco
                  ? `${customer.endereco}, ${customer.numero || ''}${customer.complemento ? ' - ' + customer.complemento : ''}`.trim()
                  : null,
                customer.cidade || null,
                customer.estado || null,
                customer.id,
              ]
            );
          } else {
            // Inserir novo cliente
            await database.query(
              `INSERT INTO customers (id, name, phone, email, cpf, address, city, state, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
              [
                customer.id,
                customer.nome,
                customer.telefone || customer.whatsapp || null,
                customer.email || null,
                customer.cpf || null,
                customer.endereco
                  ? `${customer.endereco}, ${customer.numero || ''}${customer.complemento ? ' - ' + customer.complemento : ''}`.trim()
                  : null,
                customer.cidade || null,
                customer.estado || null,
              ]
            );
          }

          synced++;
        } catch (error: any) {
          logger.error(`Erro ao sincronizar cliente ${customer.id}:`, error.message);
          errors++;
        }
      }

      logger.info(`Sincronização de clientes concluída: ${synced} sincronizados, ${errors} erros`);
      return { synced, errors };
    } catch (error: any) {
      this.logRequestError(error, '/clientes');
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Sincroniza todos os pets do VetCare com suporte a paginação
   */
  async syncPets(): Promise<{ synced: number; errors: number }> {
    logger.info('Iniciando sincronização de pets do VetCare');

    let synced = 0;
    let errors = 0;
    let page = 1;
    let hasMorePages = true;
    let totalPetsExpected = 0;

    try {
      while (hasMorePages) {
        try {
          // Tentar diferentes formatos de paginação
          const endpoint = `/pets?page=${page}`;
          logger.info(`GET ${this.config.apiUrl}${endpoint}`);
          const response = await this.client.get<any>(endpoint);

          // A API pode retornar { data: [...], meta: {...} } ou apenas um array
          const responseData = response.data;
          const petsData = responseData.data || responseData;

          if (!Array.isArray(petsData)) {
            logger.error('Resposta da API não é um array:', typeof petsData);
            logger.error('Estrutura recebida:', JSON.stringify(responseData).substring(0, 500));
            break;
          }

          // Se não há pets nesta página, terminamos
          if (petsData.length === 0) {
            logger.info(`Página ${page} vazia - fim da paginação`);
            break;
          }

          logger.info(`Página ${page}: ${petsData.length} pets recebidos`);

          // Verificar se há metadados de paginação
          if (responseData.meta) {
            const meta = responseData.meta;
            totalPetsExpected = meta.total || 0;
            const currentPage = meta.current_page || page;
            const lastPage = meta.last_page || meta.total_pages || 0;

            logger.info(`Metadados: página ${currentPage}/${lastPage}, total: ${totalPetsExpected}, items nesta página: ${petsData.length}`);

            // Se chegamos na última página
            if (currentPage >= lastPage) {
              logger.info('Última página detectada via metadados');
              hasMorePages = false;
            }
          } else {
            // Sem metadados - logar estrutura da resposta para debug
            logger.info(`Sem metadados de paginação. Estrutura: ${JSON.stringify(Object.keys(responseData)).substring(0, 200)}`);
          }

          // Limite de segurança: máximo 500 páginas
          if (page >= 500) {
            logger.warn(`Limite de segurança atingido: 500 páginas processadas. Parando sync.`);
            hasMorePages = false;
          }

          // Processar pets desta página
          for (const petData of petsData) {
            try {
              // A API já retorna a estrutura correta com cliente_id
              const pet = petData as VetCarePet;
              const clienteId = pet.cliente_id || petData.cliente?.id;

              if (!clienteId) {
                logger.warn(`Pet ${pet.id} (${pet.nome}) sem cliente_id - pulando`);
                errors++;
                continue;
              }

              // Verificar se pet já existe
              const existing = await database.query(
                'SELECT id FROM pets WHERE id = $1',
                [pet.id]
              );

              if (existing.length > 0) {
                // Atualizar pet existente
                await database.query(
                  `UPDATE pets
                   SET name = $1, species = $2, breed = $3, gender = $4,
                       birth_date = $5, customer_id = $6, weight = $7,
                       color = $8, notes = $9, updated_at = NOW()
                   WHERE id = $10`,
                  [
                    pet.nome,
                    pet.especie,
                    pet.raca || null,
                    pet.sexo,
                    pet.data_nascimento || null,
                    clienteId,
                    pet.peso || null,
                    pet.pelagem || null,
                    pet.observacoes || null,
                    pet.id,
                  ]
                );
              } else {
                // Inserir novo pet
                await database.query(
                  `INSERT INTO pets (id, name, species, breed, gender, birth_date, customer_id, weight, color, notes, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                  [
                    pet.id,
                    pet.nome,
                    pet.especie,
                    pet.raca || null,
                    pet.sexo,
                    pet.data_nascimento || null,
                    clienteId,
                    pet.peso || null,
                    pet.pelagem || null,
                    pet.observacoes || null,
                  ]
                );
              }

              synced++;

              // Log a cada 100 pets para acompanhar progresso
              if (synced % 100 === 0) {
                const expected = totalPetsExpected > 0 ? `/${totalPetsExpected}` : '';
                logger.info(`Progresso: ${synced}${expected} pets sincronizados`);
              }
            } catch (error: any) {
              logger.error(`Erro ao sincronizar pet ${petData.id || 'unknown'}:`, error.message);
              errors++;
            }
          }

          // Próxima página
          page++;

          // Aguardar 200ms entre páginas para não sobrecarregar a API
          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error: any) {
          // Se der 404, provavelmente não há mais páginas
          if (error.response?.status === 404) {
            logger.info(`Página ${page} retornou 404 - fim da paginação`);
            break;
          }

          this.logRequestError(error, `/pets?page=${page}`);

          // Se for erro de rede ou timeout, tentar mais uma vez
          if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            logger.warn(`Erro temporário na página ${page}, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          // Outros erros: parar paginação
          break;
        }
      }

      const expected = totalPetsExpected > 0 ? ` (esperado: ${totalPetsExpected})` : '';
      logger.info(`Sincronização de pets concluída: ${synced} sincronizados${expected}, ${errors} erros`);
      return { synced, errors };
    } catch (error: any) {
      this.logRequestError(error, '/pets');
      return { synced, errors: errors + 1 };
    }
  }

  /**
   * Sincroniza vacinas de um pet específico
   */
  async syncPetVaccines(petId: number): Promise<{ synced: number; errors: number }> {
    try {
      const response = await this.client.get<VetCareVacinacao[]>(`/pets/${petId}/vacinacoes`);
      const vaccines = response.data;

      if (!Array.isArray(vaccines)) {
        return { synced: 0, errors: 0 }; // Pet pode não ter vacinas
      }

      let synced = 0;
      let errors = 0;

      for (const vaccine of vaccines) {
        try {
          // Extrair nome da vacina (pode vir em vacina_nome ou vacina.nome)
          const vaccineName = vaccine.vacina?.nome || vaccine.vacina_nome;
          const veterinarianName = vaccine.veterinario?.nome || vaccine.veterinario_nome;

          if (!vaccineName) {
            logger.warn(`Vacina do pet ${petId} sem nome - pulando`);
            continue;
          }

          // Determinar se é vacina anual baseado no nome ou intervalo
          const isAnnual = vaccineName?.toLowerCase().includes('anual') ||
                          vaccineName?.toLowerCase().includes('raiva') ||
                          vaccineName?.toLowerCase().includes('v8') ||
                          vaccineName?.toLowerCase().includes('v10') ||
                          vaccineName?.toLowerCase().includes('múltipla') ||
                          vaccineName?.toLowerCase().includes('multipla');

          // Verificar se vacina já existe (baseado em pet_id, nome e data)
          const existing = await database.query(
            'SELECT id FROM vaccines WHERE pet_id = $1 AND vaccine_name = $2 AND application_date = $3',
            [petId, vaccineName, vaccine.data_aplicacao]
          );

          if (existing.length > 0) {
            // Atualizar vacina existente
            await database.query(
              `UPDATE vaccines
               SET next_dose_date = $1, is_annual = $2, batch_number = $3,
                   veterinarian = $4, notes = $5, updated_at = NOW()
               WHERE id = $6`,
              [
                vaccine.proxima_dose || vaccine.data_proxima_dose || null,
                isAnnual,
                vaccine.lote || null,
                veterinarianName || null,
                vaccine.dose || vaccine.observacoes || null,
                existing[0].id,
              ]
            );
          } else {
            // Inserir nova vacina
            await database.query(
              `INSERT INTO vaccines (pet_id, vaccine_name, application_date, next_dose_date, is_annual, batch_number, veterinarian, notes, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
              [
                petId,
                vaccineName,
                vaccine.data_aplicacao,
                vaccine.proxima_dose || vaccine.data_proxima_dose || null,
                isAnnual,
                vaccine.lote || null,
                veterinarianName || null,
                vaccine.dose || vaccine.observacoes || null,
              ]
            );
          }

          synced++;
        } catch (error: any) {
          logger.error(`Erro ao sincronizar vacina do pet ${petId}:`, error.message);
          errors++;
        }
      }

      return { synced, errors };
    } catch (error: any) {
      // Pet sem vacinas é normal, não registrar como erro
      if (error.response?.status === 404) {
        return { synced: 0, errors: 0 };
      }
      this.logRequestError(error, `/pets/${petId}/vacinacoes`);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Sincroniza todas as vacinas de todos os pets
   */
  async syncAllVaccines(): Promise<{ synced: number; errors: number }> {
    logger.info('Iniciando sincronização de vacinas do VetCare');

    try {
      // Buscar todos os pets do banco local
      const pets = await database.query<{ id: number }>('SELECT id FROM pets');

      let totalSynced = 0;
      let totalErrors = 0;

      logger.info(`Sincronizando vacinas de ${pets.length} pets...`);

      for (const pet of pets) {
        const result = await this.syncPetVaccines(pet.id);
        totalSynced += result.synced;
        totalErrors += result.errors;

        // Aguardar 100ms entre cada pet para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Sincronização de vacinas concluída: ${totalSynced} sincronizadas, ${totalErrors} erros`);
      return { synced: totalSynced, errors: totalErrors };
    } catch (error: any) {
      logger.error('Erro ao sincronizar vacinas:', error.message);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Sincroniza agendamentos do VetCare com suporte a paginação
   */
  async syncAppointments(): Promise<{ synced: number; errors: number }> {
    logger.info('Iniciando sincronização de agendamentos do VetCare');

    let synced = 0;
    let errors = 0;
    let page = 1;
    let hasMorePages = true;
    let totalExpected = 0;

    try {
      while (hasMorePages) {
        try {
          const endpoint = `/agendamentos?page=${page}`;
          logger.info(`GET ${this.config.apiUrl}${endpoint}`);
          const response = await this.client.get<any>(endpoint);

          const responseData = response.data;
          const appointments = responseData.data || responseData;

          if (!Array.isArray(appointments)) {
            logger.error('Resposta da API não é um array:', typeof appointments);
            break;
          }

          if (appointments.length === 0) {
            logger.info(`Página ${page} vazia - fim da paginação`);
            break;
          }

          logger.info(`Página ${page}: ${appointments.length} agendamentos recebidos`);

          // Verificar metadados de paginação
          if (responseData.meta) {
            const meta = responseData.meta;
            totalExpected = meta.total || 0;
            const currentPage = meta.current_page || page;
            const lastPage = meta.last_page || meta.total_pages || 0;

            logger.info(`Metadados: página ${currentPage}/${lastPage}, total: ${totalExpected}, items nesta página: ${appointments.length}`);

            if (currentPage >= lastPage) {
              logger.info('Última página detectada via metadados');
              hasMorePages = false;
            }
          } else {
            // Sem metadados - logar estrutura da resposta para debug
            logger.info(`Sem metadados de paginação. Estrutura: ${JSON.stringify(Object.keys(responseData)).substring(0, 200)}`);
          }

          // Limite de segurança: máximo 500 páginas
          if (page >= 500) {
            logger.warn(`Limite de segurança atingido: 500 páginas processadas. Parando sync.`);
            hasMorePages = false;
          }

          // Processar agendamentos desta página
          for (const appointment of appointments) {
            try {
              // Verificar se o pet existe antes de inserir
              const petExists = await database.query(
                'SELECT id FROM pets WHERE id = $1',
                [appointment.pet_id]
              );

              if (petExists.length === 0) {
                logger.warn(`Agendamento ${appointment.id} referencia pet_id=${appointment.pet_id} que não existe - pulando`);
                errors++;
                continue;
              }

              // Mapear tipo de agendamento
              let appointmentType = 'consulta';
              const tipo = appointment.tipo?.toLowerCase() || '';
              if (tipo.includes('retorno')) appointmentType = 'retorno';
              if (tipo.includes('cirurgia')) appointmentType = 'cirurgia';
              if (tipo.includes('exame')) appointmentType = 'exame';

              // Mapear status
              let status = 'agendado';
              const statusApi = appointment.status?.toLowerCase() || '';
              if (statusApi.includes('confirmado')) status = 'confirmado';
              if (statusApi.includes('concluído') || statusApi.includes('concluido')) status = 'realizado';
              if (statusApi.includes('cancelado')) status = 'cancelado';

              // Verificar se agendamento já existe
              const existing = await database.query(
                'SELECT id FROM appointments WHERE id = $1',
                [appointment.id]
              );

              if (existing.length > 0) {
                // Atualizar agendamento existente
                await database.query(
                  `UPDATE appointments
                   SET pet_id = $1, appointment_date = $2, appointment_type = $3,
                       status = $4, notes = $5, amount = $6, updated_at = NOW()
                   WHERE id = $7`,
                  [
                    appointment.pet_id,
                    appointment.data_hora,
                    appointmentType,
                    status,
                    appointment.observacoes || null,
                    appointment.valor || null,
                    appointment.id,
                  ]
                );
              } else {
                // Inserir novo agendamento
                await database.query(
                  `INSERT INTO appointments (id, pet_id, appointment_date, appointment_type, status, notes, amount, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                  [
                    appointment.id,
                    appointment.pet_id,
                    appointment.data_hora,
                    appointmentType,
                    status,
                    appointment.observacoes || null,
                    appointment.valor || null,
                  ]
                );
              }

              synced++;

              if (synced % 100 === 0) {
                const expected = totalExpected > 0 ? `/${totalExpected}` : '';
                logger.info(`Progresso: ${synced}${expected} agendamentos sincronizados`);
              }
            } catch (error: any) {
              logger.error(`Erro ao sincronizar agendamento ${appointment.id}:`, error.message);
              errors++;
            }
          }

          page++;

          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error: any) {
          if (error.response?.status === 404) {
            logger.info(`Página ${page} retornou 404 - fim da paginação`);
            break;
          }

          this.logRequestError(error, `/agendamentos?page=${page}`);

          if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            logger.warn(`Erro temporário na página ${page}, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          break;
        }
      }

      const expected = totalExpected > 0 ? ` (esperado: ${totalExpected})` : '';
      logger.info(`Sincronização de agendamentos concluída: ${synced} sincronizados${expected}, ${errors} erros`);
      return { synced, errors };
    } catch (error: any) {
      this.logRequestError(error, '/agendamentos');
      return { synced, errors: errors + 1 };
    }
  }

  /**
   * Sincroniza contas a receber do VetCare
   * REMOVIDO: Endpoint /financeiro/contas-receber está quebrado (erro 500)
   */
  async syncFinancialDebts(): Promise<{ synced: number; errors: number }> {
    logger.warn('Sincronização de contas a receber desabilitada - endpoint da API quebrado');
    return { synced: 0, errors: 0 };
  }

  /**
   * Sincroniza fichas de banho de um pet específico
   */
  async syncPetGroomingRecords(petId: number): Promise<{ synced: number; errors: number }> {
    try {
      const response = await this.client.get<VetCareFichaBanho[]>(`/pets/${petId}/fichas-banho`);
      const records = response.data;

      if (!Array.isArray(records) || records.length === 0) {
        return { synced: 0, errors: 0 };
      }

      let synced = 0;
      let errors = 0;

      for (const record of records) {
        try {
          // Parsear data (formato: DD/MM/YYYY)
          const dataParts = record.data.split('/');
          const serviceDate = dataParts.length === 3
            ? `${dataParts[2]}-${dataParts[1]}-${dataParts[0]}`
            : record.data;

          // Determinar tipo de serviço
          const servicos = record.servicos?.toLowerCase() || '';
          let serviceType = 'banho';
          if (servicos.includes('tosa') && servicos.includes('banho')) {
            serviceType = 'banho_tosa';
          } else if (servicos.includes('tosa')) {
            serviceType = 'tosa';
          }

          // Verificar se registro já existe (por pet_id e data)
          const existing = await database.query(
            'SELECT id FROM grooming_services WHERE pet_id = $1 AND service_date = $2',
            [petId, serviceDate]
          );

          if (existing.length > 0) {
            // Atualizar registro existente
            await database.query(
              `UPDATE grooming_services
               SET service_type = $1, notes = $2, updated_at = NOW()
               WHERE id = $3`,
              [
                serviceType,
                record.observacoes || null,
                existing[0].id,
              ]
            );
          } else {
            // Inserir novo registro
            await database.query(
              `INSERT INTO grooming_services (pet_id, service_date, service_type, has_plan, notes, created_at)
               VALUES ($1, $2, $3, $4, $5, NOW())`,
              [
                petId,
                serviceDate,
                serviceType,
                false, // Por padrão assume que não tem plano
                record.observacoes || null,
              ]
            );
          }

          synced++;
        } catch (error: any) {
          logger.error(`Erro ao sincronizar ficha de banho ${record.id} do pet ${petId}:`, error.message);
          errors++;
        }
      }

      return { synced, errors };
    } catch (error: any) {
      // Pet sem fichas de banho é normal
      if (error.response?.status === 404) {
        return { synced: 0, errors: 0 };
      }
      this.logRequestError(error, `/pets/${petId}/fichas-banho`);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Sincroniza todas as fichas de banho de todos os pets
   */
  async syncAllGroomingRecords(): Promise<{ synced: number; errors: number }> {
    logger.info('Iniciando sincronização de fichas de banho do VetCare');

    try {
      // Buscar todos os pets do banco local
      const pets = await database.query<{ id: number }>('SELECT id FROM pets');

      let totalSynced = 0;
      let totalErrors = 0;

      logger.info(`Sincronizando fichas de banho de ${pets.length} pets...`);

      for (const pet of pets) {
        const result = await this.syncPetGroomingRecords(pet.id);
        totalSynced += result.synced;
        totalErrors += result.errors;

        // Aguardar 100ms entre cada pet para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Sincronização de fichas de banho concluída: ${totalSynced} sincronizadas, ${totalErrors} erros`);
      return { synced: totalSynced, errors: totalErrors };
    } catch (error: any) {
      logger.error('Erro ao sincronizar fichas de banho:', error.message);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Sincroniza todos os dados do VetCare
   */
  async syncAll(): Promise<void> {
    logger.info('========================================');
    logger.info('Iniciando sincronização completa do VetCare');
    logger.info('========================================');

    const startTime = Date.now();

    const results = {
      customers: await this.syncCustomers(),
      pets: await this.syncPets(),
      vaccines: await this.syncAllVaccines(),
      appointments: await this.syncAppointments(),
      grooming: await this.syncAllGroomingRecords(),
    };

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info('========================================');
    logger.info('Sincronização completa do VetCare finalizada');
    logger.info(`Tempo total: ${totalTime}s`);
    logger.info(`Clientes: ${results.customers.synced} sincronizados, ${results.customers.errors} erros`);
    logger.info(`Pets: ${results.pets.synced} sincronizados, ${results.pets.errors} erros`);
    logger.info(`Vacinas: ${results.vaccines.synced} sincronizadas, ${results.vaccines.errors} erros`);
    logger.info(`Agendamentos: ${results.appointments.synced} sincronizados, ${results.appointments.errors} erros`);
    logger.info(`Banhos/Tosas: ${results.grooming.synced} sincronizados, ${results.grooming.errors} erros`);
    logger.info('NOTA: Sincronização financeira desabilitada (endpoint da API quebrado)');
    logger.info('========================================');
  }
}

export const vetcareApiService = new VetCareApiService();
