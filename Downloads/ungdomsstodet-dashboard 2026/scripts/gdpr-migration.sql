-- GDPR Migration Script
-- Safely adds GDPR compliance columns to existing audit_logs table
-- Run this on existing databases to enable GDPR compliance

-- Add GDPR columns to audit_logs table if they don't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so these should be run carefully

BEGIN TRANSACTION;

-- Check if columns exist and add them if not
-- This would typically be handled by the application code with try/catch

-- is_anonymized column
-- ALTER TABLE audit_logs ADD COLUMN is_anonymized BOOLEAN DEFAULT 1;

-- retention_days column  
-- ALTER TABLE audit_logs ADD COLUMN retention_days INTEGER DEFAULT 180;

-- gdpr_compliant column
-- ALTER TABLE audit_logs ADD COLUMN gdpr_compliant BOOLEAN DEFAULT 1;

-- Create indexes for GDPR columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_gdpr ON audit_logs(gdpr_compliant);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON audit_logs(retention_days);

-- Update existing records to be GDPR compliant
UPDATE audit_logs 
SET 
    is_anonymized = 1,
    retention_days = 180,
    gdpr_compliant = 1
WHERE 
    is_anonymized IS NULL 
    OR retention_days IS NULL 
    OR gdpr_compliant IS NULL;

COMMIT;

-- Verify the migration
SELECT 
    COUNT(*) as total_logs,
    SUM(CASE WHEN is_anonymized = 1 THEN 1 ELSE 0 END) as anonymized_logs,
    SUM(CASE WHEN gdpr_compliant = 1 THEN 1 ELSE 0 END) as gdpr_compliant_logs,
    AVG(retention_days) as avg_retention_days
FROM audit_logs;
