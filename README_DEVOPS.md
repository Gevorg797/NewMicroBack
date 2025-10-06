# Bik-Bet Platform - DevOps Guide

## Overview
This is a microservices-based gaming platform with NestJS applications and shared libraries.

## Services Architecture

### 1. Admin App
- **Port**: 3000
- **Prefix**: `admin`
- **Purpose**: Admin interface for managing games and platform
- **Type**: HTTP API
- **Dependencies**: Game Service (TCP), Database

### 2. Game Service
- **Ports**: 3010 (HTTP) + 3005 (TCP)
- **Prefix**: `games`
- **Purpose**: Game logic and provider integrations
- **Type**: Hybrid (HTTP + TCP)
- **Dependencies**: Database, External APIs (Superomatic, B2BSlots)

### 3. Finance Service
- **Ports**: 3003 (HTTP) + 5000 (TCP)
- **Prefix**: `finance`
- **Purpose**: Financial operations and transactions
- **Type**: Hybrid (HTTP + TCP)
- **Dependencies**: Database, External APIs

### 4. API Gateway
- **Port**: 3002
- **Prefix**: `api`
- **Purpose**: Main API gateway and bot integrations
- **Type**: HTTP API
- **Dependencies**: Game Service (TCP), Finance Service (TCP)

### 5. File Service
- **Port**: 3003 (TCP only)
- **Purpose**: File upload/management with S3 integration
- **Type**: TCP Microservice
- **Dependencies**: AWS S3, Database (optional)

### 6. Cronjobs Service
- **Port**: N/A (no HTTP/TCP by default)
- **Prefix**: `cronjobs`
- **Purpose**: Background scheduled jobs using `@nestjs/schedule`
- **Type**: Application
- **Dependencies**: Database (optional), external APIs (optional)

## Environment Variables

Each microservice has its own environment configuration. Create `.env` files in each app directory:

### Admin App (.env in apps/admin/)
```bash
# Environment
NODE_ENV=DEV

# Database Configuration
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=


# Service Configuration
ADMIN_PORT=
```

### Game Service (.env in apps/game-service/)
```bash
# Environment
NODE_ENV=DEV

# Database Configuration
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=


# Service Configuration
GAME_HTTP_PORT=
GAME_TCP_PORT=
GAME_TCP_HOST=
```

### Finance Service (.env in apps/finance-service/)
```bash
# Environment
NODE_ENV=DEV

# Database Configuration
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=


# Service Configuration
FINANCE_TCP_HOST=
FINANCE_TCP_PORT=
FINANCE_HTTP_PORT=
```

### API Gateway (.env in apps/api/)
```bash
# Environment
NODE_ENV=DEV

# Database Configuration
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

# Service Configuration
APP_PORT=

# Bot Configuration
BOT_TOKEN=
```

### File Service (.env in apps/file-service/)
```bash
# Environment
NODE_ENV=DEV

# Service Configuration
FILE_SERVICE_HOST=
FILE_SERVICE_PORT=

# AWS S3 Configuration
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_ENDPOINT=

# Optional: Database Configuration (for file metadata)
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
```

### Cronjobs Service (.env in apps/cronjobs/)
```bash
# Environment
NODE_ENV=DEV

# Optional: Database Configuration (if jobs access DB)
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

# Optional: External API configuration for jobs
CRONJOBS_PORT=
```

## Build Commands

### Install Dependencies
```bash
# Install all dependencies (root level)
npm install
```

### Build All Services
```bash
# Build all services at once
npm run build
```

**Note**: `npm run build` builds all microservices using the `scripts/build-all.ts` script.

## Run Commands

### Development Mode
```bash
# Run specific service in development
npm run start:admin:dev
npm run start:api:dev
npm run start:game-service:dev
npm run start:finance-service:dev
npm run start:file-service:dev
npm run start:cronjobs:dev
```

### Production Mode
```bash
# Run specific service in production
npm run start:admin:prod
npm run start:api:prod
npm run start:game-service:prod
npm run start:finance-service:prod
npm run start:file-service:prod
npm run start:cronjobs:prod
```

**Note**: Each microservice has its own environment configuration and runs independently.

### Environment Values
- **Development**: `NODE_ENV=DEV`
- **Production**: `NODE_ENV=PROD`

