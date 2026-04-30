import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      payload =
        typeof raw === 'string'
          ? { message: raw }
          : raw && typeof raw === 'object'
            ? raw
            : {};
    } else if (exception && typeof exception === 'object') {
      payload = { message: (exception as any).message };
    }

    const message =
      String(
        payload?.message ||
          payload?.error ||
          (status >= 500 ? '服务器开小差了，请稍后重试' : '请求失败'),
      ) || '请求失败';

    const code = payload?.code ? String(payload.code) : undefined;

    res.status(status).json({
      statusCode: status,
      code,
      message,
      path: String(req?.url || ''),
      timestamp: new Date().toISOString(),
    });
  }
}
