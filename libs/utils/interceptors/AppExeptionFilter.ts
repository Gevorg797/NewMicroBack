import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

// MikroORM errors
import {
  ValidationError as MikroValidationError,
  NotFoundError as MikroNotFoundError,
  UniqueConstraintViolationException,
  NotNullConstraintViolationException,
  ForeignKeyConstraintViolationException,
  OptimisticLockError,
  DriverException,
} from '@mikro-orm/core';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // Default status
    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof (exception as any)?.status === 'number'
          ? (exception as any).status
          : HttpStatus.INTERNAL_SERVER_ERROR;

    // Default payload
    const base = {
      data: null,
      error: this.getName(exception),
      message: 'An unexpected error occurred',
      status,
    };

    // 1) Nest HttpException (ValidationPipe, custom throws, etc.)
    if (exception instanceof HttpException) {
      const body = exception.getResponse() as any;
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ?? exception.message);

      return res.status(status).send({
        ...base,
        error: exception.name,
        message,
        status,
      });
    }

    // 2) MikroORM — specific constraint/driver errors
    if (exception instanceof UniqueConstraintViolationException) {
      status = HttpStatus.CONFLICT;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Unique constraint violated',
        error: 'UniqueConstraintViolation',
      });
    }

    if (exception instanceof NotNullConstraintViolationException) {
      status = HttpStatus.BAD_REQUEST;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Not-null constraint violated',
        error: 'NotNullConstraintViolation',
      });
    }

    if (exception instanceof ForeignKeyConstraintViolationException) {
      status = HttpStatus.CONFLICT;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Foreign key constraint violated',
        error: 'ForeignKeyConstraintViolation',
      });
    }

    if (exception instanceof OptimisticLockError) {
      status = HttpStatus.CONFLICT;
      return res.status(status).send({
        ...base,
        status,
        message:
          exception.message ||
          'Optimistic lock failed. Please retry the action.',
        error: 'OptimisticLockError',
      });
    }

    if (exception instanceof MikroValidationError) {
      status = HttpStatus.BAD_REQUEST;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Validation failed',
        error: 'ValidationError',
      });
    }

    if (exception instanceof MikroNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Entity not found',
        error: 'NotFoundError',
      });
    }

    if (exception instanceof DriverException) {
      // Generic DB/driver failure
      status = HttpStatus.BAD_REQUEST;
      return res.status(status).send({
        ...base,
        status,
        message: exception.message || 'Database driver error',
        error: 'DriverException',
      });
    }

    // 3) (Optional) Legacy/Mongoose-style cases you had
    if (this.getName(exception) === 'ValidationError') {
      const key = this.safeLastKey((exception as any)?.errors);
      const validationMessage =
        key && (exception as any)?.errors?.[key]?.message
          ? (exception as any).errors[key].message
          : 'Validation failed';

      status = HttpStatus.BAD_REQUEST;
      return res.status(status).send({
        ...base,
        status,
        message: validationMessage,
        error: 'ValidationError',
      });
    }

    if (this.getName(exception) === 'DocumentNotFoundError') {
      status = HttpStatus.NOT_FOUND;
      return res.status(status).send({
        ...base,
        status,
        message: (exception as any)?.message || 'Document not found',
        error: 'DocumentNotFoundError',
      });
    }

    // 4) Unknown errors — log and return safe message
    this.logger.error(
      `[${this.getName(exception)}] ${this.getMessage(exception)}`,
      (exception as any)?.stack,
    );

    return res.status(status).send({
      ...base,
      status,
      message: this.getMessage(exception) || base.message,
    });
  }

  private getName(e: unknown): string {
    return (e as any)?.name ?? 'UnknownError';
  }
  private getMessage(e: unknown): string {
    return (e as any)?.message ?? '';
  }
  private safeLastKey(obj: any): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const keys = Object.keys(obj);
    return keys[keys.length - 1];
  }
}
