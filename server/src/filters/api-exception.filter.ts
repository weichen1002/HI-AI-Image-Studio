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
          ? { msg: raw }
          : raw && typeof raw === 'object'
            ? raw
            : {};
    } else if (exception && typeof exception === 'object') {
      payload = { msg: (exception as any).message };
    }

    const msgRaw = payload?.msg ?? payload?.message ?? payload?.error ?? '';
    const msg = Array.isArray(msgRaw)
      ? msgRaw.filter(Boolean).join('；')
      : String(msgRaw || '');

    res.status(status).json({
      code: status,
      msg: msg || (status >= 500 ? '服务器开小差了，请稍后重试' : '请求失败'),
      data: null,
    });
  }
}
