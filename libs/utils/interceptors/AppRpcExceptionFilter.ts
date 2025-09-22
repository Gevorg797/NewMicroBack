import {
    Catch,
    ArgumentsHost,
    RpcExceptionFilter,
    HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

// MikroORM errors
import {
    DriverException,
    UniqueConstraintViolationException,
    ForeignKeyConstraintViolationException,
    NotNullConstraintViolationException,
    OptimisticLockError,
    ValidationError,
    NotFoundError,
} from '@mikro-orm/core';

type AnyErr = any;

/** ---- Axios helpers (unchanged) ---- */
function isAxiosError(err: AnyErr): boolean {
    return (
        !!err &&
        (err.isAxiosError === true ||
            (err.config && (err.response || err.request)))
    );
}

function mapAxiosToPayload(err: AnyErr) {
    const code: string | undefined = err?.code;
    let status =
        typeof err?.response?.status === 'number'
            ? err.response.status
            : typeof err?.status === 'number'
                ? err.status
                : 500;

    if (!err?.response) {
        if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') status = 504;
        else if (
            code === 'ENOTFOUND' ||
            code === 'ECONNREFUSED' ||
            code === 'EAI_AGAIN' ||
            code === 'ECONNRESET'
        )
            status = 502;
        else if (code === 'ERR_CANCELED') status = 499 as any;
    }

    const message =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Upstream provider error';

    const details =
        (typeof err?.response?.data === 'object' && err.response.data) || undefined;

    return {
        error: err?.name || code || 'AxiosError',
        message,
        status,
        code,
        details,
    };
}

/** ---- Filter ---- */
@Catch()
export class AppRpcExceptionFilter implements RpcExceptionFilter {
    catch(exception: AnyErr, _host: ArgumentsHost): Observable<never> {
        // 0) Preserve existing RpcException payload
        if (exception instanceof RpcException) {
            return throwError(() => exception);
        }

        // 0.5) Map HttpException to RpcException
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const response = exception.getResponse();
            const message =
                typeof response === 'object'
                    ? (response as any).message ?? exception.message
                    : response;

            return throwError(
                () =>
                    new RpcException({
                        error: exception.name,
                        message,
                        status,
                        details: typeof response === 'object' ? response : undefined,
                    }),
            );
        }

        // 1) Axios / upstream HTTP errors
        if (isAxiosError(exception)) {
            const payload = mapAxiosToPayload(exception);
            return throwError(() => new RpcException(payload));
        }

        // 2) Provider failover (custom error example)
        if (exception?.name === 'ProviderFailoverError') {
            const status =
                typeof exception?.status === 'number' ? exception.status : 503;
            return throwError(
                () =>
                    new RpcException({
                        error: exception.name,
                        message: exception.message,
                        status,
                        details: exception.reasons ?? [],
                    }),
            );
        }

        // 3) MikroORM errors
        // Note: MikroORM wraps driver errors in typed exceptions (preferred),
        // but can also expose raw `DriverException`s. We handle both.
        if (exception instanceof UniqueConstraintViolationException) {
            const duplicateField =
                (exception as any)?.constraint ||
                (exception as any)?.cause?.constraint ||
                'unique_constraint';
            return throwError(
                () =>
                    new RpcException({
                        error: 'UniqueConstraintViolation',
                        message: `Duplicate entry (${duplicateField})`,
                        status: 409,
                        details: {
                            constraint: duplicateField,
                            cause: serializeCause(exception),
                        },
                    }),
            );
        }

        if (exception instanceof ForeignKeyConstraintViolationException) {
            const constraint =
                (exception as any)?.constraint ||
                (exception as any)?.cause?.constraint ||
                'foreign_key_constraint';
            return throwError(
                () =>
                    new RpcException({
                        error: 'ForeignKeyConstraintViolation',
                        message: `Foreign key constraint violation (${constraint})`,
                        status: 409,
                        details: {
                            constraint,
                            cause: serializeCause(exception),
                        },
                    }),
            );
        }

        if (exception instanceof NotNullConstraintViolationException) {
            const column =
                (exception as any)?.column ||
                (exception as any)?.cause?.column ||
                'unknown_field';
            return throwError(
                () =>
                    new RpcException({
                        error: 'NotNullConstraintViolation',
                        message: `Not null constraint violated for ${column}`,
                        status: 400,
                        details: {
                            column,
                            cause: serializeCause(exception),
                        },
                    }),
            );
        }

        if (exception instanceof OptimisticLockError) {
            return throwError(
                () =>
                    new RpcException({
                        error: 'OptimisticLockError',
                        message:
                            exception.message ||
                            'Optimistic locking failed for the requested entity',
                        status: 409, // or 412 Precondition Failed
                    }),
            );
        }

        if (exception instanceof ValidationError) {
            // MikroORM ValidationError may contain nested errors/details
            return throwError(
                () =>
                    new RpcException({
                        error: 'ValidationError',
                        message: exception.message || 'Validation failed',
                        status: 400,
                        details: (exception as any)?.errors || undefined,
                    }),
            );
        }

        if (exception instanceof NotFoundError) {
            return throwError(
                () =>
                    new RpcException({
                        error: 'NotFoundError',
                        message: exception.message || 'Entity not found',
                        status: 404,
                    }),
            );
        }

        if (exception instanceof DriverException) {
            // Generic DB driver error fallback (when not one of the typed ones above)
            const code =
                (exception as any)?.code ||
                (exception as any)?.cause?.code ||
                undefined;
            return throwError(
                () =>
                    new RpcException({
                        error: 'DriverException',
                        message: exception.message || 'Database error',
                        status: 500,
                        code,
                        details: serializeCause(exception),
                    }),
            );
        }

        // 4) Default mapping
        const status =
            typeof exception?.status === 'number'
                ? exception.status
                : typeof exception?.response?.status === 'number'
                    ? exception.response.status
                    : 500;

        const message =
            exception?.response?.data?.message ??
            exception?.response?.message ??
            exception?.message ??
            'Internal server error';

        const errorName = exception?.name || exception?.code || 'UnknownError';

        return throwError(
            () =>
                new RpcException({
                    error: errorName,
                    message,
                    status,
                    details: tryPickUsefulDetails(exception),
                }),
        );
    }
}

/** ---- utils ---- */
function serializeCause(err: any) {
    const c = err?.cause ?? err?.driverException ?? undefined;
    if (!c) return undefined;

    // cherry-pick without leaking huge objects
    const out: Record<string, any> = {};
    for (const k of ['code', 'constraint', 'detail', 'column', 'schema', 'table']) {
        if (c?.[k] !== undefined) out[k] = c[k];
    }
    if (typeof c?.message === 'string') out.message = c.message;
    return Object.keys(out).length ? out : undefined;
}

function tryPickUsefulDetails(exception: any) {
    // Avoid dumping the whole error; pick common fields
    const details: Record<string, any> = {};
    for (const k of ['code', 'detail', 'constraint', 'column']) {
        if (exception?.[k] !== undefined) details[k] = exception[k];
        if (exception?.cause?.[k] !== undefined && details[k] === undefined) {
            details[k] = exception.cause[k];
        }
    }
    return Object.keys(details).length ? details : undefined;
}
