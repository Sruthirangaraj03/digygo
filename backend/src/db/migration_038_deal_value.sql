-- Migration 038: Add deal_value column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12,2) DEFAULT 0;
