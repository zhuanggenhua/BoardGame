import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        // 临时日志：排查 500 错误的根因
        if (!(exception instanceof HttpException)) {
            console.error('[GlobalHttpExceptionFilter] Unhandled exception:', exception);
        }

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = '服务器异常';
        let code: string | undefined;

        if (exception instanceof HttpException) {
            const httpException = exception as HttpException;
            status = httpException.getStatus();
            const responseBody = httpException.getResponse();
            if (typeof responseBody === 'object' && responseBody !== null && 'code' in responseBody && typeof responseBody.code === 'string') {
                code = responseBody.code;
            }

            if (typeof responseBody === 'string') {
                message = responseBody;
            } else if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
                const rawMessage = (responseBody as { message?: string | string[] }).message;
                if (Array.isArray(rawMessage)) {
                    message = rawMessage.join(', ');
                } else if (typeof rawMessage === 'string') {
                    message = rawMessage;
                }
            }
        }

        response.status(status).json({
            error: message,
            statusCode: status,
            ...(code ? { code } : {}),
            path: request?.url,
            timestamp: new Date().toISOString(),
        });
    }
}
