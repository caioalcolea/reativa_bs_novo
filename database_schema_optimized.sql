-- =========================================================================
-- SCHEMA OTIMIZADO POSTGRESQL - Bot Reativação Veterinária
-- Baseado na estrutura real da API VetCare
-- =========================================================================

-- Conectar ao database
-- \c bot_reativacao_vet

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- TABELA: customers (Clientes)
-- =========================================================================
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,  -- ID do VetCare (não SERIAL)
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(255),
  cpf VARCHAR(14),
  rg VARCHAR(20),
  address TEXT,
  numero VARCHAR(10),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2),
  cep VARCHAR(10),
  data_nascimento DATE,
  observacoes TEXT,
  saldo_devedor NUMERIC(10, 2) DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_ativo ON customers(ativo);

-- =========================================================================
-- TABELA: pets (Animais de Estimação)
-- =========================================================================
CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY,  -- ID do VetCare (não SERIAL)
  customer_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  species VARCHAR(50),  -- Cão, Gato, Coelho, Ave, etc.
  breed VARCHAR(255),
  gender VARCHAR(20),  -- M, F
  castrado BOOLEAN DEFAULT FALSE,
  birth_date DATE,
  weight NUMERIC(10, 2),  -- Peso atual em kg
  color VARCHAR(255),  -- Pelagem/cor
  microchip VARCHAR(50),
  foto TEXT,  -- URL da foto
  alergias TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_pets_customer_id ON pets(customer_id);
CREATE INDEX idx_pets_species ON pets(species);
CREATE INDEX idx_pets_ativo ON pets(ativo);

-- =========================================================================
-- TABELA: vaccines (Vacinações)
-- =========================================================================
CREATE TABLE IF NOT EXISTS vaccines (
  id SERIAL PRIMARY KEY,  -- ID local (VetCare tem IDs por pet)
  pet_id INTEGER NOT NULL,
  vacina_id INTEGER,  -- ID da vacina no VetCare
  vaccine_name VARCHAR(255) NOT NULL,  -- vacina.nome
  veterinarian_id INTEGER,
  veterinarian_name VARCHAR(255),  -- veterinario.nome
  application_date TIMESTAMP NOT NULL,  -- data_aplicacao
  next_dose_date TIMESTAMP,  -- proxima_dose
  dose VARCHAR(50),  -- Dose (1ª, 2ª, reforço, etc)
  batch_number VARCHAR(100),  -- lote
  is_annual BOOLEAN DEFAULT FALSE,  -- Auto-detectado
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  UNIQUE (pet_id, vaccine_name, application_date)  -- Evita duplicatas
);

CREATE INDEX idx_vaccines_pet_id ON vaccines(pet_id);
CREATE INDEX idx_vaccines_next_dose_date ON vaccines(next_dose_date);
CREATE INDEX idx_vaccines_application_date ON vaccines(application_date);
CREATE INDEX idx_vaccines_is_annual ON vaccines(is_annual);

-- =========================================================================
-- TABELA: grooming_services (Serviços de Banho/Tosa)
-- =========================================================================
CREATE TYPE grooming_service_type AS ENUM ('banho', 'tosa', 'banho_tosa', 'hidratacao');
CREATE TYPE grooming_plan_type AS ENUM ('mensal', 'anual');

CREATE TABLE IF NOT EXISTS grooming_services (
  id SERIAL PRIMARY KEY,  -- ID local
  ficha_id INTEGER,  -- ID da ficha no VetCare
  pet_id INTEGER NOT NULL,
  service_date DATE NOT NULL,
  retorno_date DATE,  -- Data prevista de retorno
  service_type grooming_service_type NOT NULL,
  servicos_detalhes TEXT,  -- "Banho, Tosa, Hidratação"
  produtos_extras JSONB,  -- Array de IDs de produtos extras
  valor_total NUMERIC(10, 2),
  funcionario_nome VARCHAR(255),
  has_plan BOOLEAN DEFAULT FALSE,
  plan_type grooming_plan_type,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  UNIQUE (pet_id, service_date)  -- Evita duplicatas
);

CREATE INDEX idx_grooming_services_pet_id ON grooming_services(pet_id);
CREATE INDEX idx_grooming_services_service_date ON grooming_services(service_date);
CREATE INDEX idx_grooming_services_has_plan ON grooming_services(has_plan);
CREATE INDEX idx_grooming_services_retorno_date ON grooming_services(retorno_date);

-- =========================================================================
-- TABELA: grooming_plans (Planos de Banho)
-- =========================================================================
CREATE TABLE IF NOT EXISTS grooming_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL,
  services_included TEXT,
  breed_specific BOOLEAN DEFAULT FALSE,
  breeds TEXT,  -- Raças específicas (comma-separated)
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grooming_plans_breed_specific ON grooming_plans(breed_specific);
CREATE INDEX idx_grooming_plans_active ON grooming_plans(active);

-- =========================================================================
-- TABELA: appointments (Agendamentos)
-- =========================================================================
CREATE TYPE appointment_type AS ENUM ('consulta', 'retorno', 'cirurgia', 'exame', 'vacina', 'banho_tosa');
CREATE TYPE appointment_status AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado', 'concluido');

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,  -- ID do VetCare
  cliente_id INTEGER,
  pet_id INTEGER NOT NULL,
  servico_id INTEGER,
  veterinario_id INTEGER,
  veterinario_nome VARCHAR(255),
  appointment_date TIMESTAMP NOT NULL,  -- data_hora
  appointment_type appointment_type NOT NULL,  -- tipo
  status appointment_status DEFAULT 'agendado',
  duracao_minutos INTEGER,
  amount NUMERIC(10, 2),  -- valor
  observacoes TEXT,
  lembrete_enviado BOOLEAN DEFAULT FALSE,
  inicio_atendimento TIMESTAMP,
  fim_atendimento TIMESTAMP,
  motivo_cancelamento TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX idx_appointments_cliente_id ON appointments(cliente_id);
CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_lembrete_enviado ON appointments(lembrete_enviado);

-- =========================================================================
-- TABELA: medical_history (Histórico Médico / Consultas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS medical_history (
  id INTEGER PRIMARY KEY,  -- ID do VetCare
  agendamento_id INTEGER,
  pet_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  veterinario_id INTEGER,
  veterinario_nome VARCHAR(255),
  data_consulta TIMESTAMP NOT NULL,
  peso_atual NUMERIC(10, 2),
  temperatura NUMERIC(4, 1),
  frequencia_cardiaca INTEGER,
  frequencia_respiratoria INTEGER,
  anamnese TEXT,
  exame_fisico TEXT,
  diagnostico TEXT,
  tratamento TEXT,
  prescricao TEXT,
  observacoes TEXT,
  retorno_em INTEGER,  -- Dias para retorno
  tipo_consulta VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_medical_history_pet_id ON medical_history(pet_id);
CREATE INDEX idx_medical_history_cliente_id ON medical_history(cliente_id);
CREATE INDEX idx_medical_history_data_consulta ON medical_history(data_consulta);

-- =========================================================================
-- TABELA: weight_history (Histórico de Peso)
-- =========================================================================
CREATE TABLE IF NOT EXISTS weight_history (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL,
  peso NUMERIC(10, 2) NOT NULL,
  data_registro TIMESTAMP NOT NULL,
  origem VARCHAR(50),  -- 'Consulta', 'Banho & Tosa'
  observacao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE INDEX idx_weight_history_pet_id ON weight_history(pet_id);
CREATE INDEX idx_weight_history_data_registro ON weight_history(data_registro);

-- =========================================================================
-- TABELA: completed_services (Serviços Concluídos - Satisfação)
-- =========================================================================
CREATE TABLE IF NOT EXISTS completed_services (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL,
  service_date TIMESTAMP NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  has_taxidog BOOLEAN DEFAULT FALSE,
  has_grooming BOOLEAN DEFAULT FALSE,
  has_tosa BOOLEAN DEFAULT FALSE,
  satisfaction_sent BOOLEAN DEFAULT FALSE,
  satisfaction_sent_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
);

CREATE INDEX idx_completed_services_pet_id ON completed_services(pet_id);
CREATE INDEX idx_completed_services_service_date ON completed_services(service_date);
CREATE INDEX idx_completed_services_satisfaction_sent ON completed_services(satisfaction_sent);

-- =========================================================================
-- TABELA: reactivation_logs (Logs de Reativação)
-- =========================================================================
CREATE TYPE reactivation_type AS ENUM ('vaccine', 'financial', 'grooming', 'appointment', 'satisfaction');
CREATE TYPE reactivation_status AS ENUM ('success', 'error');

CREATE TABLE IF NOT EXISTS reactivation_logs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  reactivation_type reactivation_type NOT NULL,
  message_sent JSONB NOT NULL,
  sent_at TIMESTAMP NOT NULL,
  status reactivation_status NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_reactivation_logs_customer_id ON reactivation_logs(customer_id);
CREATE INDEX idx_reactivation_logs_reactivation_type ON reactivation_logs(reactivation_type);
CREATE INDEX idx_reactivation_logs_sent_at ON reactivation_logs(sent_at);
CREATE INDEX idx_reactivation_logs_status ON reactivation_logs(status);

-- =========================================================================
-- TRIGGERS: Auto-update de updated_at
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaccines_updated_at BEFORE UPDATE ON vaccines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grooming_services_updated_at BEFORE UPDATE ON grooming_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grooming_plans_updated_at BEFORE UPDATE ON grooming_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_history_updated_at BEFORE UPDATE ON medical_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_completed_services_updated_at BEFORE UPDATE ON completed_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- VIEWS: Consultas úteis
-- =========================================================================
CREATE OR REPLACE VIEW vw_customer_summary AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.whatsapp,
  c.email,
  c.ativo,
  COUNT(DISTINCT p.id) as total_pets,
  COUNT(DISTINCT v.id) as total_vaccines,
  COUNT(DISTINCT a.id) as total_appointments,
  COUNT(DISTINCT gs.id) as total_grooming_services,
  COUNT(DISTINCT mh.id) as total_consultas
FROM customers c
LEFT JOIN pets p ON p.customer_id = c.id
LEFT JOIN vaccines v ON v.pet_id = p.id
LEFT JOIN appointments a ON a.pet_id = p.id
LEFT JOIN grooming_services gs ON gs.pet_id = p.id
LEFT JOIN medical_history mh ON mh.cliente_id = c.id
GROUP BY c.id, c.name, c.phone, c.whatsapp, c.email, c.ativo;

CREATE OR REPLACE VIEW vw_pets_with_stats AS
SELECT
  p.*,
  c.name as customer_name,
  c.phone as customer_phone,
  COUNT(DISTINCT v.id) as total_vaccines,
  COUNT(DISTINCT a.id) as total_appointments,
  COUNT(DISTINCT gs.id) as total_grooming,
  COUNT(DISTINCT mh.id) as total_consultas,
  MAX(v.next_dose_date) as next_vaccine_date,
  MAX(gs.service_date) as last_grooming_date,
  MAX(mh.data_consulta) as last_consulta_date
FROM pets p
INNER JOIN customers c ON c.id = p.customer_id
LEFT JOIN vaccines v ON v.pet_id = p.id
LEFT JOIN appointments a ON a.pet_id = p.id
LEFT JOIN grooming_services gs ON gs.pet_id = p.id
LEFT JOIN medical_history mh ON mh.pet_id = p.id
GROUP BY p.id, c.name, c.phone;

-- =========================================================================
-- COMENTÁRIOS
-- =========================================================================
COMMENT ON TABLE customers IS 'Clientes sincronizados do VetCare';
COMMENT ON TABLE pets IS 'Pets com dados completos do VetCare';
COMMENT ON TABLE vaccines IS 'Histórico de vacinação completo';
COMMENT ON TABLE grooming_services IS 'Histórico de serviços de banho/tosa';
COMMENT ON TABLE appointments IS 'Agendamentos sincronizados';
COMMENT ON TABLE medical_history IS 'Histórico médico completo (consultas, anamnese)';
COMMENT ON TABLE weight_history IS 'Histórico de evolução de peso';
COMMENT ON TABLE completed_services IS 'Serviços concluídos para pesquisa de satisfação';
COMMENT ON TABLE reactivation_logs IS 'Log de todas as reativações enviadas';

-- =========================================================================
-- DADOS INICIAIS: Planos de Banho
-- =========================================================================
INSERT INTO grooming_plans (name, description, monthly_price, services_included, breed_specific, breeds, active)
VALUES
  ('Plano Básico', 'Banho mensal com produtos de qualidade', 89.90, 'Banho, secagem, perfume', FALSE, NULL, TRUE),
  ('Plano Completo', 'Banho e tosa mensal', 149.90, 'Banho, tosa higiênica, secagem, perfume, corte de unhas', FALSE, NULL, TRUE),
  ('Plano Premium', 'Banho, tosa e hidratação', 199.90, 'Banho, tosa completa, hidratação, secagem, perfume, corte de unhas, limpeza de ouvidos', FALSE, NULL, TRUE)
ON CONFLICT DO NOTHING;
