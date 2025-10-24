import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// Utility function that can be called directly
export const checkIsTelegramAdmin = async (ctx: any): Promise<boolean> => {
  const adminIds = [838474735, 923465091]; // Add your admin telegram IDs
  const userId = ctx?.from?.id;

  if (!adminIds.includes(userId)) {
    await ctx.reply('⛔ У вас нет доступа к админ-панели');
    return false;
  }

  return true;
};
