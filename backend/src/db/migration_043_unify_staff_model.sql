-- Unify staff permissions model:
-- 1. Rename admin to staff for all white-label users (is_owner bypasses via code)
-- 2. Backfill full user_permissions for any users who do not have a row yet
-- 3. Fix contradiction where leads:only_assigned and leads:view_all are both true
-- 4. Remove dead workflows keys and replace with automation keys

UPDATE users SET role = 'staff' WHERE role = 'admin' AND tenant_id IS NOT NULL;

DO $$
DECLARE
  full_access_json jsonb := jsonb_build_object(
    'dashboard:total_leads', true,
    'dashboard:active_staff', true,
    'dashboard:conversations', true,
    'dashboard:appointments', true,
    'meta_forms:read', true, 'meta_forms:create', true, 'meta_forms:edit', true, 'meta_forms:delete', true,
    'custom_forms:read', true, 'custom_forms:create', true, 'custom_forms:edit', true, 'custom_forms:delete', true,
    'landing_pages:read', true, 'landing_pages:create', true, 'landing_pages:edit', true, 'landing_pages:delete', true,
    'whatsapp_setup:read', true, 'whatsapp_setup:manage', true,
    'leads:view_all', true, 'leads:create', true, 'leads:edit', true, 'leads:delete', true, 'leads:view_own', true,
    'leads:only_assigned', false, 'leads:mask_phone', false,
    'contacts:read', true, 'contacts:create', true, 'contacts:edit', true, 'contacts:delete', true,
    'contact_groups:read', true, 'contact_groups:manage', true,
    'automation:view', true, 'automation:manage', true,
    'automation_templates:read', true, 'automation_templates:manage', true,
    'whatsapp_automation:read', true, 'whatsapp_automation:manage', true,
    'inbox:view_all', true, 'inbox:send', true,
    'fields:view', true, 'fields:manage', true,
    'staff:view', true, 'staff:manage', true,
    'settings:manage', true,
    'calendar:manage', true,
    'pipeline:manage', true
  );
BEGIN
  INSERT INTO user_permissions (user_id, tenant_id, permissions)
  SELECT u.id, u.tenant_id, full_access_json
  FROM users u
  WHERE u.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;

UPDATE user_permissions
SET permissions = permissions || '{"leads:only_assigned": false}'
WHERE (permissions->>'leads:only_assigned')::boolean = true
  AND (permissions->>'leads:view_all')::boolean = true;

UPDATE user_permissions
SET permissions = (
  permissions
  - 'workflows:view'
  - 'workflows:create'
  - 'workflows:edit'
  - 'workflows:delete'
) || jsonb_build_object(
  'automation:view',
    COALESCE((permissions->>'workflows:view')::boolean, (permissions->>'automation:view')::boolean, false),
  'automation:manage',
    COALESCE((permissions->>'workflows:create')::boolean, false) OR
    COALESCE((permissions->>'workflows:edit')::boolean, false) OR
    COALESCE((permissions->>'workflows:delete')::boolean, false) OR
    COALESCE((permissions->>'automation:manage')::boolean, false)
)
WHERE permissions ? 'workflows:view'
   OR permissions ? 'workflows:create'
   OR permissions ? 'workflows:edit'
   OR permissions ? 'workflows:delete';
