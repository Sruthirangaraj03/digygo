-- Migration 071: Add sent_by column to messages for tracking message origin
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_by VARCHAR(20);
