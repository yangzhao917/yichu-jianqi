import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Dypnsapi, * as $Dypnsapi from '@alicloud/dypnsapi20170525';
import { $OpenApiUtil } from '@alicloud/openapi-core';

type PendingCode = { outId?: string; expiresAt: number; sentAt: number };

type DypnsConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  schemeName?: string;
  signName: string;
  templateCode: string;
  templateParam: string;
  regionId: string;
  endpoint: string;
};

/**
 * 阿里云号码认证服务的短信认证边界。
 * 只把验证码发送和核验交给 Dypnsapi，不在本地保存验证码明文；
 * 缺少服务配置时直接失败，避免把本地验证码误当成真实登录。
 */
@Injectable()
export class AliyunNumberAuthProvider {
  private readonly pending = new Map<string, PendingCode>();

  private normalize(phone: string) {
    const value = phone.replace(/[\s-]/g, '');
    return value.startsWith('+86') ? value.slice(3) : value.startsWith('86') && value.length === 13 ? value.slice(2) : value;
  }

  private dypnsConfig(): DypnsConfig {
    const accessKeyId = process.env.ALIYUN_DYPNS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_DYPNS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET;
    const required: Record<string, string | undefined> = {
      ALIYUN_DYPNS_ACCESS_KEY_ID: accessKeyId,
      ALIYUN_DYPNS_ACCESS_KEY_SECRET: accessKeySecret,
      ALIYUN_DYPNS_SIGN_NAME: process.env.ALIYUN_DYPNS_SIGN_NAME,
      ALIYUN_DYPNS_TEMPLATE_CODE: process.env.ALIYUN_DYPNS_TEMPLATE_CODE,
    };
    const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE', message: `阿里云号码认证服务未配置：${missing.join(', ')}` });
    return {
      accessKeyId: accessKeyId!,
      accessKeySecret: accessKeySecret!,
      schemeName: process.env.ALIYUN_DYPNS_SCHEME_NAME || undefined,
      signName: process.env.ALIYUN_DYPNS_SIGN_NAME!,
      templateCode: process.env.ALIYUN_DYPNS_TEMPLATE_CODE!,
      // 号码认证服务要求显式传入模板参数；##code## 让平台生成并托管验证码。
      // 不把验证码明文放进环境变量或本地状态，模板含其它变量时由部署配置覆盖。
      templateParam: process.env.ALIYUN_DYPNS_TEMPLATE_PARAM || JSON.stringify({ code: '##code##' }),
      regionId: process.env.ALIYUN_DYPNS_REGION_ID || 'cn-hangzhou',
      endpoint: process.env.ALIYUN_DYPNS_ENDPOINT || 'dypnsapi.aliyuncs.com',
    };
  }

  private client(config: DypnsConfig) {
    return new Dypnsapi(new $OpenApiUtil.Config({ accessKeyId: config.accessKeyId, accessKeySecret: config.accessKeySecret, regionId: config.regionId, endpoint: config.endpoint }));
  }

  async requestCode(rawPhone: string) {
    const phone = this.normalize(rawPhone);
    const config = this.dypnsConfig();
    const previous = this.pending.get(phone);
    if (previous && Date.now() - previous.sentAt < 60_000) throw new HttpException({ code: 'SMS_COOLDOWN', message: '验证码发送过于频繁，请稍后再试' }, HttpStatus.TOO_MANY_REQUESTS);
    try {
      const response = await this.client(config).sendSmsVerifyCode(new $Dypnsapi.SendSmsVerifyCodeRequest({ phoneNumber: phone, countryCode: '86', schemeName: config.schemeName, signName: config.signName, templateCode: config.templateCode, templateParam: config.templateParam, codeLength: 6, codeType: 1, validTime: 300, interval: 60, duplicatePolicy: 1, returnVerifyCode: false }));
      const body = response.body;
      if (body?.code !== 'OK' || body.success === false) throw new Error(body?.message || body?.code || '号码认证服务未接受发送请求');
      this.pending.set(phone, { outId: body.model?.outId, expiresAt: Date.now() + 5 * 60_000, sentAt: Date.now() });
      return { status: 'sent', expiresIn: 300, message: '验证码已发送' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_ERROR', message: `阿里云号码认证服务发送失败：${error instanceof Error ? error.message : 'unknown error'}` });
    }
  }

  async verifyCode(rawPhone: string, code: string) {
    const phone = this.normalize(rawPhone);
    const config = this.dypnsConfig();
    const pending = this.pending.get(phone);
    if (!pending || pending.expiresAt < Date.now()) {
      this.pending.delete(phone);
      return false;
    }
    try {
      const response = await this.client(config).checkSmsVerifyCode(new $Dypnsapi.CheckSmsVerifyCodeRequest({ phoneNumber: phone, countryCode: '86', schemeName: config.schemeName, outId: pending.outId, verifyCode: code }));
      const body = response.body;
      const passed = body?.code === 'OK' && body.success !== false && body.model?.verifyResult === 'PASS';
      if (passed) this.pending.delete(phone);
      return passed;
    } catch (error) {
      throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_ERROR', message: `阿里云号码认证服务核验失败：${error instanceof Error ? error.message : 'unknown error'}` });
    }
  }
}
