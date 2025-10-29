import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// Utility function that can be called directly
export const checkIsTelegramAdmin = async (ctx: any): Promise<boolean> => {
  const adminIds = [838474735, 923465091, 6019160432]; // Add your admin telegram IDs
  const userId = ctx?.from?.id;

  if (!adminIds.includes(userId)) {
    return false;
  }

  return true;
};
