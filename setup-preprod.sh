#!/bin/bash

# Pre-Production Setup Script
# This script helps you set up the pre-prod environment

set -e

echo "=========================================="
echo "Pre-Production Setup Guide"
echo "=========================================="
echo ""

# Check if .env.preprod exists
if [ ! -f .env.preprod ]; then
    echo "❌ .env.preprod not found!"
    echo ""
    echo "Steps to set up pre-prod:"
    echo ""
    echo "1. Copy the environment template:"
    echo "   cp .env.preprod.example .env.preprod"
    echo ""
    echo "2. Get Supabase credentials:"
    echo "   - Visit https://app.supabase.com"
    echo "   - Create a new project or use existing"
    echo "   - Go to Settings > Database"
    echo "   - Copy Host, Port, User, Password"
    echo ""
    echo "3. Get MongoDB Atlas URI:"
    echo "   - Visit https://cloud.mongodb.com"
    echo "   - Create cluster or use existing"
    echo "   - Click 'Connect' and select 'Connect your application'"
    echo "   - Copy the connection string"
    echo "   - Include username:password in the URI"
    echo ""
    echo "4. Get Pinata JWT:"
    echo "   - Visit https://app.pinata.cloud/keys"
    echo "   - Create new API Key or use existing"
    echo "   - Copy the JWT token"
    echo ""
    echo "5. Edit .env.preprod with your values:"
    echo "   nano .env.preprod"
    echo ""
    echo "6. Start services:"
    echo "   docker-compose -f docker-compose.preprod.yml --env-file .env.preprod up -d"
    echo ""
    exit 1
fi

echo "✓ .env.preprod found"
echo ""

# Validate required environment variables
required_vars=(
    "SUPABASE_HOST"
    "SUPABASE_USER"
    "SUPABASE_PASSWORD"
    "MONGODB_ATLAS_URI"
    "PINATA_JWT"
    "JWT_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env.preprod || grep "^$var=" .env.preprod | grep -q "your_"; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing or placeholder values for:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env.preprod and fill in all values"
    exit 1
fi

echo "✓ All required environment variables are set"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

echo "✓ Docker found"
echo ""

# Show services to be started
echo "Services to be started:"
echo "  - NGINX Gateway (port 80)"
echo "  - Redis (local, port 6379)"
echo "  - Auth Service (Go, port 8080 internal)"
echo "  - Channel Service (Go, port 8081 internal)"
echo "  - Worker Service (Go, background)"
echo "  - Node.js Backend (port 5000 internal)"
echo "  - Frontend (port 5173 internal)"
echo ""
echo "External Services (via environment variables):"
echo "  - Supabase PostgreSQL"
echo "  - MongoDB Atlas"
echo "  - Pinata IPFS"
echo ""

read -p "Ready to start? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting pre-prod environment..."
    docker-compose -f docker-compose.preprod.yml --env-file .env.preprod up -d
    echo ""
    echo "✓ Pre-prod environment started!"
    echo ""
    echo "Access your application:"
    echo "  - Frontend: http://localhost"
    echo "  - Health: http://localhost/health"
    echo ""
    echo "Monitor services:"
    echo "  docker-compose -f docker-compose.preprod.yml logs -f"
    echo ""
    echo "Stop services:"
    echo "  docker-compose -f docker-compose.preprod.yml down"
else
    echo "Setup cancelled"
    exit 1
fi
