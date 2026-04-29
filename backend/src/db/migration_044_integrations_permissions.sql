-- Add integrations:view and integrations:manage keys to all existing user_permissions rows.
-- Full-access rows (is_owner users and most staff) get both keys true.
-- Rows that had settings:manage=false get integrations:manage=false (restricted staff).

UPDATE user_permissions
SET permissions = permissions
  || jsonb_build_object(
       'integrations:view',   TRUE,
       'integrations:manage', COALESCE((permissions->>'settings:manage')::boolean, FALSE)
     )
WHERE permissions ? 'leads:view_all'
  AND NOT (permissions ? 'integrations:view');
