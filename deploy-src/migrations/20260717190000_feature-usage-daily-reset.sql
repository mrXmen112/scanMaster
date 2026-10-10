-- Add usage_date column for daily reset tracking
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS usage_date DATE DEFAULT CURRENT_DATE;

-- Drop old unique constraint
ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_user_id_feature_key;

-- Drop any old unique constraint that may exist with different name
ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS unique_user_feature;

-- Add new unique constraint with date
ALTER TABLE feature_usage ADD CONSTRAINT unique_user_feature_date UNIQUE (user_id, feature, usage_date);

-- Backfill usage_date for existing rows (set to today so they don't block new daily usage)
UPDATE feature_usage SET usage_date = CURRENT_DATE WHERE usage_date IS NULL;
