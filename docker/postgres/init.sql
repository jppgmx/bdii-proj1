-- Executado pelo PostgreSQL somente na inicialização de um volume novo.
-- A migração 001 também habilita a extensão em bancos externos.
CREATE EXTENSION IF NOT EXISTS postgis;
