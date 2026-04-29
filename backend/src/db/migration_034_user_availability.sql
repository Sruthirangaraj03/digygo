-- user_availability: per-user working hours by day of week
CREATE TABLE IF NOT EXISTS user_availability (
  id          UUID     DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID     NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME     NOT NULL DEFAULT '09:00',
  end_time    TIME     NOT NULL DEFAULT '17:00',
  is_active   BOOLEAN  NOT NULL DEFAULT true,
  UNIQUE (user_id, day_of_week)
);

-- track which event type a booking came from (enables max_per_day enforcement)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_type_id UUID;
