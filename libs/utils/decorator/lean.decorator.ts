import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { ClassTransformOptions, plainToInstance } from 'class-transformer';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@nestjs/swagger';

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor {
  constructor(
    private readonly dto: Type<T>,
    private readonly options?: ClassTransformOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (Array.isArray(data.docs)) {
          // Handle paginated responses with `docs`
          return {
            ...data,
            docs: data.docs.map((item) =>
              plainToInstance(this.dto, item, {
                excludeExtraneousValues: true,
                ...this.options,
              }),
            ),
          };
        }

        if (Array.isArray(data)) {
          // Handle array responses
          return data.map((item) =>
            plainToInstance(this.dto, item, {
              excludeExtraneousValues: true,
              ...this.options,
            }),
          );
        }

        // Handle single object responses
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
          ...this.options,
        });
      }),
    );
  }
}

export function Lean(
  dto: Type<any>,
  isArray: boolean = false,
  options?: ClassTransformOptions,
) {
  return applyDecorators(
    UseInterceptors(new TransformInterceptor(dto, options)),
    ApiResponse({
      type: dto,
      isArray,
    }),
  );
}
