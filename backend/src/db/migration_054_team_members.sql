-- Multi-staff assignment: add team_members UUID array to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS team_members UUID[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_team_members ON leads USING GIN(team_members);
