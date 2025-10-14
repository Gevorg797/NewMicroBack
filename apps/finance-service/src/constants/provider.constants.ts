/**
 * Payment provider constants
 */

export const PAYMENT_PROVIDER_NAMES = {
  YOOMONEY: 'yoomoney',
  FREEKASSA: 'freekassa',
  CRYPTOBOT: 'cryptobot',
  PLATEGA: 'platega',
} as const;

export const PAYMENT_PROVIDER_IDENTIFIERS = {
  YOOMONEY: ['yoomoney', 'youmoney', 'yumani', 'yandex'],
  FREEKASSA: ['freekassa', 'freekasa', 'free kassa'],
  CRYPTOBOT: ['cryptobot', 'crypto bot'],
  PLATEGA: ['platega', 'plat'],
} as const;

export type PaymentProviderName =
  (typeof PAYMENT_PROVIDER_NAMES)[keyof typeof PAYMENT_PROVIDER_NAMES];
