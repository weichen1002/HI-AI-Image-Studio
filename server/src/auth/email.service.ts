import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SystemSettingsRepo } from '../db/repositories/system-settings.repo';

@Injectable()
export class EmailService {
  constructor(private readonly settingsRepo: SystemSettingsRepo) {}

  async sendVerificationEmail(params: {
    to: string;
    verifyUrl: string;
  }) {
    const settings = this.settingsRepo.getGeneralSettings();
    const subject = settings.mailSubject || '验证你的邮箱';
    const html = [
      `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;">`,
      `<p>你好，</p>`,
      `<p>请点击下面的链接完成邮箱验证：</p>`,
      `<p><a href="${params.verifyUrl}">${params.verifyUrl}</a></p>`,
      `<p>如果这不是你的操作，请忽略此邮件。</p>`,
      `</div>`,
    ].join('');

    if (settings.mailProvider === 'mock') {
      console.log('[EmailService][mock] send verification email', {
        to: params.to,
        subject,
        verifyUrl: params.verifyUrl,
      });
      return { ok: true, provider: 'mock' };
    }

    if (settings.mailProvider === 'resend') {
      if (!settings.mailApiKey || !settings.mailFrom) {
        throw new HttpException('邮件配置不完整', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.mailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: settings.mailFrom,
          to: [params.to],
          subject,
          html,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new HttpException(
          `发送验证邮件失败：${text || response.status}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return { ok: true, provider: 'resend' };
    }

    if (settings.mailProvider === 'smtp-http') {
      if (!settings.mailApiUrl || !settings.mailFrom) {
        throw new HttpException('邮件配置不完整', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const response = await fetch(settings.mailApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.mailApiKey ? { Authorization: `Bearer ${settings.mailApiKey}` } : {}),
        },
        body: JSON.stringify({
          from: settings.mailFrom,
          to: params.to,
          subject,
          html,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new HttpException(
          `发送验证邮件失败：${text || response.status}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return { ok: true, provider: 'smtp-http' };
    }

    throw new HttpException('不支持的邮件服务提供方', HttpStatus.BAD_REQUEST);
  }
}
