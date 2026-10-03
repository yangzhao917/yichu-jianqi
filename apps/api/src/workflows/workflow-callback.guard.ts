import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class WorkflowCallbackGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configured = process.env.WORKFLOW_CALLBACK_TOKEN;
    if (!configured) throw new ServiceUnavailableException({ code: 'CALLBACK_NOT_CONFIGURED', message: '工作流回调令牌尚未配置' });
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const token = request.headers['x-workflow-callback-token'];
    if (!token || token !== configured) throw new UnauthorizedException({ code: 'CALLBACK_UNAUTHORIZED', message: '工作流回调令牌无效' });
    return true;
  }
}
