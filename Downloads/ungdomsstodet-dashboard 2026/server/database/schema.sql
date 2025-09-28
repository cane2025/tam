-- Ungdomsstöd V2 Database Schema
-- GDPR compliant - no personal numbers stored

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table (staff members)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clients table (no personal numbers - GDPR compliant)
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    initials TEXT NOT NULL, -- e.g., "AB", "CD" - anonymized identifiers
    name TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Care plans table
CREATE TABLE IF NOT EXISTS care_plans (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    care_plan_date DATE,
    has_gfp BOOLEAN NOT NULL DEFAULT 0,
    staff_notified BOOLEAN NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- Weekly documentation table
CREATE TABLE IF NOT EXISTS weekly_docs (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    week_id TEXT NOT NULL, -- Format: 'YYYY-WXX'
    monday BOOLEAN NOT NULL DEFAULT 0,
    tuesday BOOLEAN NOT NULL DEFAULT 0,
    wednesday BOOLEAN NOT NULL DEFAULT 0,
    thursday BOOLEAN NOT NULL DEFAULT 0,
    friday BOOLEAN NOT NULL DEFAULT 0,
    saturday BOOLEAN NOT NULL DEFAULT 0,
    sunday BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, week_id)
);

-- Monthly reports table
CREATE TABLE IF NOT EXISTS monthly_reports (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    month_id TEXT NOT NULL, -- Format: 'YYYY-MM'
    sent BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, month_id)
);

-- Visma time tracking table
CREATE TABLE IF NOT EXISTS visma_time (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    week_id TEXT NOT NULL, -- Format: 'YYYY-WXX'
    monday BOOLEAN NOT NULL DEFAULT 0,
    tuesday BOOLEAN NOT NULL DEFAULT 0,
    wednesday BOOLEAN NOT NULL DEFAULT 0,
    thursday BOOLEAN NOT NULL DEFAULT 0,
    friday BOOLEAN NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE(client_id, week_id)
);

-- Idempotency table for safe API operations
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    operation TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_staff_id ON clients(staff_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_client_id ON care_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_weekly_docs_client_id ON weekly_docs(client_id);
CREATE INDEX IF NOT EXISTS idx_weekly_docs_week_id ON weekly_docs(week_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_client_id ON monthly_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month_id ON monthly_reports(month_id);
CREATE INDEX IF NOT EXISTS idx_visma_time_client_id ON visma_time(client_id);
CREATE INDEX IF NOT EXISTS idx_visma_time_week_id ON visma_time(week_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- Triggers to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users 
    FOR EACH ROW 
    BEGIN 
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_clients_updated_at 
    AFTER UPDATE ON clients 
    FOR EACH ROW 
    BEGIN 
        UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_care_plans_updated_at 
    AFTER UPDATE ON care_plans 
    FOR EACH ROW 
    BEGIN 
        UPDATE care_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_weekly_docs_updated_at 
    AFTER UPDATE ON weekly_docs 
    FOR EACH ROW 
    BEGIN 
        UPDATE weekly_docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_monthly_reports_updated_at 
    AFTER UPDATE ON monthly_reports 
    FOR EACH ROW 
    BEGIN 
        UPDATE monthly_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_visma_time_updated_at 
    AFTER UPDATE ON visma_time 
    FOR EACH ROW 
    BEGIN 
        UPDATE visma_time SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- GDPR-compliant audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    actor_id TEXT NOT NULL, -- Anonymized user ID for GDPR compliance
    actor_role TEXT NOT NULL, -- User role (not sensitive data)
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT NOT NULL, -- JSON string with sanitized data
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    is_anonymized BOOLEAN DEFAULT 1, -- GDPR compliance flag
    retention_days INTEGER DEFAULT 180, -- Data retention period
    gdpr_compliant BOOLEAN DEFAULT 1 -- Overall GDPR compliance flag
);

-- Audit logs indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_gdpr ON audit_logs(gdpr_compliant);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON audit_logs(retention_days);

-- For existing databases, add GDPR columns if they don't exist
-- These are handled safely in the application code with try/catch
-- ALTER TABLE audit_logs ADD COLUMN is_anonymized BOOLEAN DEFAULT 1;
-- ALTER TABLE audit_logs ADD COLUMN retention_days INTEGER DEFAULT 180;
-- ALTER TABLE audit_logs ADD COLUMN gdpr_compliant BOOLEAN DEFAULT 1;

