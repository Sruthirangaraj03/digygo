-- Theme colors for tenant branding (app background + accent)
-- Note brand_color already exists from migration_081
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS app_bg_color TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accent_color TEXT;
