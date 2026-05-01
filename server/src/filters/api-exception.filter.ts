import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { config } from '../config';

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
      const code = (exception as any).code;
      const type = (exception as any).type;
      const exceptionStatus =
        Number((exception as any).statusCode) || Number((exception as any).status);
      if (code === 'LIMIT_FILE_SIZE' || type === 'entity.too.large') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        const maxMb = Math.max(
          1,
          Math.floor(Number(config.UPLOAD_MAX_FILE_SIZE || 0) / (1024 * 1024)),
        );
        payload = { msg: `上传内容过大，请控制在 ${maxMb}MB 以内` };
      } else if (exceptionStatus) {
        status = exceptionStatus;
        payload = { msg: (exception as any).message };
      } else {
      payload = { msg: (exception as any).message };
      }
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
