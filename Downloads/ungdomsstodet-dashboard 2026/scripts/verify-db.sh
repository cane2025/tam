#!/bin/bash

# 🗄️ Database Verification Script
# Validates database integrity and schema

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

DB_FILE="data/ungdomsstod.db"

echo "🗄️ Verifying database..."

# Check if database file exists
if [[ ! -f "$DB_FILE" ]]; then
    error "Database file not found: $DB_FILE"
fi

success "Database file exists"

# Check database integrity
if command -v sqlite3 >/dev/null 2>&1; then
    # Check database integrity
    if sqlite3 "$DB_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
        success "Database integrity check passed"
    else
        error "Database integrity check failed"
    fi
    
    # Check if required tables exist
    REQUIRED_TABLES=(
        "users"
        "clients"
        "care_plans"
        "weekly_docs"
        "monthly_reports"
        "visma_time"
        "audit_logs"
        "feature_flags"
    )
    
    for table in "${REQUIRED_TABLES[@]}"; do
        if sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q "$table"; then
            success "Table '$table' exists"
        else
            error "Required table '$table' not found"
        fi
    done
    
    # Check database size
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    success "Database size: $DB_SIZE"
    
    # Check if database is writable
    if [[ -w "$DB_FILE" ]]; then
        success "Database is writable"
    else
        warning "Database is not writable"
    fi
    
else
    warning "sqlite3 not found, skipping detailed database checks"
fi

success "Database verification completed"
