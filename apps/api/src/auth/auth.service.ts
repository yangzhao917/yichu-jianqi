import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, Role, ROLES } from '../common/constants';
import { LoginDto } from './dto/login.dto';
import { RequestCodeDto } from './dto/request-code.dto';
import { RegisterDto } from './dto/register.dto';
import { AliyunNumberAuthProvider } from './aliyun-number-auth.provider';

const REGISTRATION_TICKET_PURPOSE = 'enterprise-registration';
const REGISTRATION_TICKET_TTL = '10m';

type RegistrationTicket = {
  purpose?: string;
  phone?: string;
};

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(JwtService) private readonly jwt: JwtService, @Inject(AliyunNumberAuthProvider) private readonly numberAuth: AliyunNumberAuthProvider) {}

  async requestCode(dto: RequestCodeDto) {
    return this.numberAuth.requestCode(dto.phone);
  }

  async login(dto: LoginDto) {
    if (!(await this.numberAuth.verifyCode(dto.phone, dto.code))) {
      throw new UnauthorizedException({ code: 'LOGIN_FAILED', message: '手机号或验证码不正确' });
    }
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone.replace(/[\s-]/g, '') }, include: { organization: { select: { id: true, slug: true } } } });
    if (!user) {
      const registrationToken = await this.issueRegistrationTicket(dto.phone.replace(/[\s-]/g, ''));
      throw new UnauthorizedException({ code: 'ACCOUNT_NOT_REGISTERED', message: '手机号尚未注册，请补充企业信息', details: { registrationToken, expiresIn: 600 } });
    }
    if (!ROLES.includes(user.role as Role)) throw new UnauthorizedException({ code: 'LOGIN_FAILED', message: '账号角色已失效' });
    const safeUser: AuthUser = { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role as Role, organizationId: user.organizationId, brandSlug: user.organization?.slug ?? null };
    const accessToken = await this.jwt.signAsync({ sub: safeUser.id, email: safeUser.email, phone: safeUser.phone, name: safeUser.name, role: safeUser.role, organizationId: safeUser.organizationId, brandSlug: safeUser.brandSlug });
    return { accessToken, tokenType: 'Bearer', expiresIn: process.env.JWT_EXPIRES_IN ?? '8h', user: safeUser };
  }

  async register(dto: RegisterDto) {
    const phone = await this.readRegistrationTicket(dto.registrationToken);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new UnauthorizedException({ code: 'PHONE_REGISTERED', message: '手机号已注册，请直接登录' });
    const creditCode = dto.creditCode.toUpperCase();
    const organizationExists = await this.prisma.organization.findFirst({ where: { creditCode } });
    if (organizationExists) throw new UnauthorizedException({ code: 'CREDIT_CODE_REGISTERED', message: '统一社会信用代码已注册' });
    const baseSlug = this.slugFromName(dto.organizationName, creditCode);
    const slug = await this.uniqueSlug(baseSlug);
    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { slug, name: dto.organizationName.trim(), creditCode, description: dto.description?.trim() || null } });
      return tx.user.create({ data: { email: `${slug}@local.invalid`, phone, name: '企业管理员', role: 'admin', organizationId: organization.id, passwordHash: 'unused' }, include: { organization: { select: { id: true, slug: true } } } });
    });
    return this.issueToken(user);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: { select: { id: true, slug: true } } } });
    if (!user || !ROLES.includes(user.role as Role)) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID', message: '用户不存在或角色已失效' });
    }
    return { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role as Role, organizationId: user.organizationId, brandSlug: user.organization?.slug ?? null };
  }

  private issueToken(user: any) {
    const safeUser: AuthUser = { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role as Role, organizationId: user.organizationId, brandSlug: user.organization?.slug ?? null };
    return this.jwt.signAsync({ sub: safeUser.id, email: safeUser.email, phone: safeUser.phone, name: safeUser.name, role: safeUser.role, organizationId: safeUser.organizationId, brandSlug: safeUser.brandSlug }).then((accessToken) => ({ accessToken, tokenType: 'Bearer', expiresIn: process.env.JWT_EXPIRES_IN ?? '8h', user: safeUser }));
  }

  private async issueRegistrationTicket(phone: string) {
    return this.jwt.signAsync({ purpose: REGISTRATION_TICKET_PURPOSE, phone }, { expiresIn: REGISTRATION_TICKET_TTL });
  }

  private async readRegistrationTicket(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<RegistrationTicket>(token);
      const phone = payload.purpose === REGISTRATION_TICKET_PURPOSE ? payload.phone?.replace(/[\s-]/g, '') : '';
      if (!phone || !/^1\d{10}$/.test(phone)) throw new Error('invalid registration ticket');
      return phone;
    } catch {
      throw new UnauthorizedException({ code: 'REGISTRATION_TOKEN_INVALID', message: '注册凭证已失效，请返回登录页重新验证手机号' });
    }
  }

  private slugFromName(name: string, creditCode: string) {
    const text = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'organization';
    return `${text}-${creditCode.slice(-6).toLowerCase()}`;
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    let index = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) slug = `${base}-${index++}`;
    return slug;
  }
}
