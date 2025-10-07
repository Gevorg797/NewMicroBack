import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Transaction not found exception
 */
export class TransactionNotFoundException extends NotFoundException {
  constructor(transactionId: number) {
    super(`Transaction with ID ${transactionId} not found`);
  }
}

/**
 * Provider not found exception
 */
export class UnknownProviderException extends BadRequestException {
  constructor(providerName: string) {
    super(`Unknown payment provider: ${providerName}`);
  }
}

/**
 * Unsupported provider exception
 */
export class UnsupportedProviderException extends BadRequestException {
  constructor(providerName: string) {
    super(
      `Payment provider ${providerName} is not supported or not configured`,
    );
  }
}

/**
 * Provider settings not found exception
 */
export class ProviderSettingsNotFoundException extends NotFoundException {
  constructor(providerName: string) {
    super(`Provider settings not found for: ${providerName}`);
  }
}

/**
 * Balance not found exception
 */
export class BalanceNotFoundException extends NotFoundException {
  constructor(userId: number) {
    super(`Balance not found for user: ${userId}`);
  }
}

/**
 * Insufficient balance exception
 */
export class InsufficientBalanceException extends BadRequestException {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance. Required: ${required}, Available: ${available}`,
    );
  }
}

/**
 * Transaction already processed exception
 */
export class TransactionAlreadyProcessedException extends BadRequestException {
  constructor(transactionId: number, status: string) {
    super(
      `Transaction ${transactionId} already processed with status: ${status}`,
    );
  }
}
