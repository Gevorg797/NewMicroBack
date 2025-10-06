import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Allow, IsEmail } from 'class-validator';

export function ParseEmail() {
  return applyDecorators(
    Transform(({ value }) => {
      return value?.trim();
    }),
    Allow(),
    IsEmail(),
  );
}
