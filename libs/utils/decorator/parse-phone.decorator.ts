import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Allow } from 'class-validator';
import { parsePhone } from '../functions';

export function ParsePhone() {
  return applyDecorators(
    Transform(({ value }) => {
      return parsePhone(value);
    }),
    Allow(),
  );
}
