# Superomatic Real Session Implementation Guide

## Overview
This guide explains how to implement and test real game sessions with Superomatic.

## Complete Flow

### 1. Admin App → Game Service (TCP calls)
- `POST /games/session` - Initialize real session (via TCP to game service)
- `POST /games/close-session` - Close session (via TCP to game service)

### 2. Game Service → Superomatic (HTTP calls)
- Game service calls Superomatic API to initialize sessions

### 3. Superomatic → Game Service (HTTP webhook calls)
- `POST /games/partner-webhooks/check-session` - Validate session
- `POST /games/partner-webhooks/check-balance` - Get player balance
- `POST /games/partner-webhooks/withdraw-bet` - Handle bet withdrawal
- `POST /games/partner-webhooks/deposit-win` - Handle winnings deposit
- `POST /games/partner-webhooks/trx-cancel` - Handle transaction cancellation
- `POST /games/partner-webhooks/trx-complete` - Handle transaction completion

## Testing Real Session

### Step 1: Initialize Real Session (via Admin App)
```bash
# Call admin app which forwards to game service via TCP
curl -X POST http://localhost:3000/games/session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "siteId": 1,
    "params": {
      "partnerAlias": "RBT",
      "partnerSession": "user_1_session_123",
      "gameId": 288,
      "currency": "RUB"
    }
  }'
```

### Step 1b: Direct Game Service Call (for testing)
```bash
# Call game service directly (bypasses admin app)
curl -X POST http://localhost:3010/games/session \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "siteId": 1,
    "params": {
      "partnerAlias": "RBT",
      "partnerSession": "user_1_session_123",
      "gameId": 288,
      "currency": "RUB"
    }
  }'
```

### Step 2: Expected Response
```json
{
  "casinoBrand": "some",
  "clientDist": "https://example.com",
  "token": "85520955afda57b28905181593440dbb",
  "targetElement": "game"
}
```

### Step 3: Launch Game
Use the response to create iframe URL:
```
https://example.com?t=85520955afda57b28905181593440dbb
```

```html
<iframe src="https://example.com?t=85520955afda57b28905181593440dbb"></iframe>
```

## Webhook Implementation

### Required Partner Side Endpoints

1. **`/check-session`** - Called by Superomatic to validate session
2. **`/check-balance`** - Called by Superomatic to get player balance
3. **`/withdraw-bet`** - Called by Superomatic to withdraw bet amount
4. **`/deposit-win`** - Called by Superomatic to deposit winnings
5. **`/trx-cancel`** - Called by Superomatic to cancel transaction
6. **`/trx-complete`** - Called by Superomatic to complete transaction

### Webhook Data Examples

#### Check Session
```json
{
  "partner.alias": "RBT",
  "partner.session": "user_1_session_123",
  "session.id": "superomatic_session_456"
}
```

#### Check Balance
```json
{
  "partner.alias": "RBT",
  "partner.session": "user_1_session_123",
  "currency": "RUB"
}
```

#### Withdraw Bet
```json
{
  "partner.alias": "RBT",
  "partner.session": "user_1_session_123",
  "trx.id": "trx_789",
  "amount": 1000,
  "currency": "RUB"
}
```

#### Deposit Win
```json
{
  "partner.alias": "RBT",
  "partner.session": "user_1_session_123",
  "trx.id": "trx_789",
  "amount": 2500,
  "currency": "RUB"
}
```

## Database Requirements

### Game Provider Settings
```sql
INSERT INTO game_provider_settings (
  provider_id,
  site_id,
  base_url,
  key,
  token,  -- This becomes partner.alias
  created_at,
  updated_at
) VALUES (
  1,  -- Superomatic provider ID
  1,  -- Your site ID
  'https://api.superplat.pw/api/gisv2',
  'your_secret_key',
  'RBT',  -- Partner alias
  NOW(),
  NOW()
);
```

## Environment Variables

```bash
# Superomatic Configuration
SUPEROMATIC_PROVIDER_ID=1
SUPEROMATIC_BASE_URL=https://api.superplat.pw/api/gisv2
SUPEROMATIC_SECRET_KEY=your_secret_key
SUPEROMATIC_PARTNER_ALIAS=RBT
```

## Error Handling

### Common Errors and Solutions

1. **"wrong partner config"**
   - Check `partner.alias` matches your provider settings
   - Verify `partner.session` is valid

2. **"no session"**
   - Ensure session exists in your database
   - Check session hasn't expired

3. **"json syntax error"**
   - Verify parameter format (use dot notation)
   - Check data types (integers for amounts)

4. **"NumberFormatException"**
   - Convert amounts to cents (multiply by 100)
   - Use integers instead of decimals

## Testing Checklist

- [ ] Provider settings configured in database
- [ ] Partner alias matches provider settings
- [ ] Session ID is unique and valid
- [ ] Webhook endpoints are accessible
- [ ] Signature validation implemented
- [ ] Balance management working
- [ ] Transaction handling implemented

## Next Steps

1. **Configure your database** with provider settings
2. **Test webhook endpoints** with sample data
3. **Implement signature validation** for security
4. **Add balance management** logic
5. **Test complete flow** with real Superomatic API
