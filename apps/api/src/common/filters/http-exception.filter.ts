import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (!(exception instanceof HttpException)) console.error('[api] unhandled exception', exception);
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
    const message = typeof body.message === 'string' ? body.message : Array.isArray(body.message) ? body.message.join('；') : '服务器处理请求时发生错误';
    response.status(status).json({ error: { code: typeof body.code === 'string' ? body.code : this.defaultCode(status), message, details: body.details ?? null }, statusCode: status, timestamp: new Date().toISOString() });
  }

  private defaultCode(status: number) {
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 413) return 'UPLOAD_TOO_LARGE';
    return 'INTERNAL_ERROR';
  }
}
