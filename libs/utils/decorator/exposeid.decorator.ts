import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

const TransformId = (property?: string) =>
  (() => (target: object, propertyKey: string) => {
    Transform(({ obj }) => {
      if (property) {
        obj[propertyKey] = obj[property]?.toString();
      }
      if (Array.isArray(obj[property || propertyKey])) {
        return (obj[property || propertyKey] as []).map((x: any) =>
          x?.toString(),
        );
      }

      return obj[property || propertyKey]?.toString();
    })(target, property || propertyKey);
  })();

export function ExposeId(property?: string) {
  return applyDecorators(Expose(), TransformId(property), ApiProperty());
}
