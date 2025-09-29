#!/bin/bash

# 🔍 Environment Variables Verification Script
# Validates that all required environment variables are set

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

# Required environment variables
REQUIRED_VARS=(
    "NODE_ENV"
    "JWT_SECRET"
    "CLIENT_URL"
)

# Optional environment variables
OPTIONAL_VARS=(
    "DATABASE_URL"
    "PORT"
    "LOG_LEVEL"
)

echo "🔍 Verifying environment variables..."

# Check required variables
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        error "Required environment variable $var is not set"
    else
        success "$var is set"
    fi
done

# Check optional variables
for var in "${OPTIONAL_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        warning "$var is not set (optional)"
    else
        success "$var is set"
    fi
done

# Validate specific values
if [[ "$NODE_ENV" != "production" ]]; then
    warning "NODE_ENV is not set to 'production' (current: $NODE_ENV)"
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
    error "JWT_SECRET must be at least 32 characters long"
fi

if [[ ! "$CLIENT_URL" =~ ^https?:// ]]; then
    error "CLIENT_URL must be a valid URL (current: $CLIENT_URL)"
fi

success "All environment variables validated successfully"
