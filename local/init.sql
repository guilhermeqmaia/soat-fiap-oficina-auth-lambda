-- Banco de teste local: reproduz a tabela `cliente` do monolito (Fase 2) e
-- acrescenta a coluna `ativo` usada para exercitar o cenario de 403.
CREATE TABLE IF NOT EXISTS cliente (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  cpf_cnpj   TEXT NOT NULL UNIQUE,
  email      TEXT,
  telefone   TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cliente (nome, cpf_cnpj, email, telefone, ativo) VALUES
  ('Ana Souza',     '529.982.247-25', 'ana@example.com',   '11999990001', TRUE),
  ('Bruno Almeida', '11144477735',    'bruno@example.com', '11999990002', TRUE),
  ('Carla Dias',    '987.654.321-00', 'carla@example.com', '11999990003', FALSE)
ON CONFLICT (cpf_cnpj) DO NOTHING;
