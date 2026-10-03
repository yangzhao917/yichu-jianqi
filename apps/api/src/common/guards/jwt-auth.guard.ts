import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestWithUser, AuthUser } from '../constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '需要登录后继续操作' });
    }
    try {
      const token = header.slice('Bearer '.length).trim();
      const payload = this.jwt.verify<AuthUser & { sub: string }>(token);
      if (!payload?.sub || !payload?.role) throw new Error('invalid payload');
      request.user = { id: payload.sub, email: payload.email, phone: payload.phone, name: payload.name, role: payload.role, organizationId: payload.organizationId, brandSlug: payload.brandSlug };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: '登录状态已失效，请重新登录' });
    }
  }
}
