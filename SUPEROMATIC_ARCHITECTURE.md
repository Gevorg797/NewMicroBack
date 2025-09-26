# Superomatic Architecture Overview

## Service Architecture

### 1. Admin App (Port 3000)
- **Purpose**: Admin interface for managing games
- **Communication**: TCP client to Game Service
- **Endpoints**: 
  - `POST /games/session` - Initialize real session
  - `POST /games/close-session` - Close session
  - `POST /games/demo-session` - Initialize demo session
  - `POST /games/load-games` - Load games from Superomatic

### 2. Game Service (Port 3010 HTTP + Port 3005 TCP)
- **Purpose**: Game logic and Superomatic integration
- **Communication**: 
  - **TCP Server**: Receives calls from Admin App
  - **HTTP Server**: Receives webhooks from Superomatic
- **Endpoints**:
  - **TCP (Internal)**: `@MessagePattern` handlers for Admin App
  - **HTTP (External)**: Webhook endpoints for Superomatic

### 3. Superomatic API
- **Purpose**: External game provider
- **Communication**: HTTP calls from Game Service
- **Webhooks**: HTTP calls to Game Service

## Communication Flow

```
Admin App (TCP) → Game Service (TCP) → Superomatic API (HTTP)
                ↑                    ↓
                └── Game Service (HTTP) ← Superomatic Webhooks (HTTP)
```

## Detailed Flow

### 1. Initialize Real Session
```
Admin App → Game Service (TCP) → Superomatic API (HTTP)
```

1. **Admin App** calls `POST /games/session`
2. **Game Service** receives TCP message `superomatic.initGameSession`
3. **Game Service** calls Superomatic API `/init.session`
4. **Superomatic** validates session by calling Game Service webhooks
5. **Game Service** returns session config to Admin App

### 2. Superomatic Webhooks
```
Superomatic API (HTTP) → Game Service (HTTP)
```

1. **Superomatic** calls `POST /games/partner-webhooks/check-session`
2. **Superomatic** calls `POST /games/partner-webhooks/check-balance`
3. **Superomatic** calls `POST /games/partner-webhooks/withdraw-bet`
4. **Superomatic** calls `POST /games/partner-webhooks/deposit-win`

## File Structure

### Admin App
```
apps/admin/src/games/
├── games.controller.ts          # HTTP endpoints for admin
├── games.service.ts             # Business logic
├── games.module.ts              # Module configuration
└── dto/                         # Request/response DTOs
    ├── game-session.dto.ts
    ├── check-balance.dto.ts
    └── ...
```

### Game Service
```
apps/game-service/src/Superomatic-v2/
├── superomatic.controller.ts    # TCP message handlers
├── superomatic.service.ts       # Superomatic API logic
├── partner-webhooks.controller.ts # HTTP webhook endpoints
├── partner-webhooks.service.ts  # Webhook business logic
├── superomatic.api.service.ts   # HTTP client for Superomatic
├── provider-settings.service.ts # Database settings
└── superomatic.module.ts        # Module configuration
```

### Microservice Client
```
libs/microservices-clients/ms-game/
├── ms-game.service.ts          # TCP client for Game Service
├── ms-game.module.ts           # Module configuration
└── tokens.ts                   # Injection tokens
```

## Port Configuration

- **Admin App**: `3000` (HTTP)
- **Game Service**: `3010` (HTTP) + `3005` (TCP)
- **Superomatic**: External API

## Environment Variables

```bash
# Game Service
GAME_HTTP_PORT=3010
GAME_TCP_PORT=3005
GAME_TCP_HOST=0.0.0.0

# Superomatic
SUPEROMATIC_PROVIDER_ID=1
SUPEROMATIC_BASE_URL=https://api.superplat.pw/api/gisv2
SUPEROMATIC_SECRET_KEY=your_secret_key
```

## Testing

### 1. Test Admin App → Game Service (TCP)
```bash
curl -X POST http://localhost:3000/games/session \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "siteId": 1, "params": {...}}'
```

### 2. Test Game Service Direct (HTTP)
```bash
curl -X POST http://localhost:3010/games/session \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "siteId": 1, "params": {...}}'
```

### 3. Test Superomatic Webhooks
```bash
curl -X POST http://localhost:3010/games/partner-webhooks/check-session \
  -H "Content-Type: application/json" \
  -d '{"partner.session": "test_session", "session.id": "test_id"}'
```

## Benefits of This Architecture

1. **Separation of Concerns**: Admin handles UI, Game Service handles game logic
2. **Scalability**: Game Service can be scaled independently
3. **Security**: Webhooks are isolated to Game Service
4. **Maintainability**: Clear boundaries between services
5. **Flexibility**: Game Service can handle multiple providers
