CREATE TABLE IF NOT EXISTS bova_payment_user (
  id SERIAL PRIMARY KEY,
  "telegramId" VARCHAR(64) UNIQUE NOT NULL,
  "username" VARCHAR(64),
  "firstName" VARCHAR(128),
  "lastName" VARCHAR(128),
  balance DOUBLE PRECISION NOT NULL DEFAULT 100,
  "promoActivated" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bova_payment_user_telegram_id
  ON bova_payment_user ("telegramId");
