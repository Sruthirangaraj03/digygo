-- Migration 045: introduce first-class 'owner' role
-- Business owners were previously stored as role='staff'/'admin' with is_owner=TRUE.
-- Promote them to role='owner' so the JWT carries the role directly,
-- eliminating async DB lookups for every permission check.

-- Promote any is_owner=TRUE users regardless of their current role
UPDATE users
  SET role = 'owner'
WHERE is_owner = TRUE
  AND role != 'owner';
