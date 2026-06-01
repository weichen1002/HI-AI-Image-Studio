import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { config, validateStartupConfig } from '../config';
import { SqliteService } from '../db/sqlite.service';

type CheckStatus = 'ok' | 'warn' | 'error';

function checkWritableDirectory(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
  const probePath = path.join(
    dirPath,
    `.healthcheck-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  fs.writeFileSync(probePath, 'ok');
  fs.unlinkSync(probePath);
}

function publicConfigSummary() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    database: 'sqlite',
    hiapi: {
      baseUrlConfigured: Boolean(config.HIAPI_BASE_URL),
      modelConfigured: Boolean(config.HIAPI_MODEL),
      apiKeyConfigured: Boolean(config.HIAPI_API_KEY),
      textModelConfigured: Boolean(config.HIAPI_TEXT_MODEL),
      responseFormat: config.HIAPI_RESPONSE_FORMAT,
      sizeFormat: config.HIAPI_SIZE_FORMAT,
    },
    billing: {
      webhookSecretConfigured: Boolean(config.BILLING_WEBHOOK_SECRET),
    },
    jobs: {
      concurrency: config.IMAGE_JOB_CONCURRENCY,
    },
  };
}

@Controller('api/health')
export class HealthController {
  constructor(private readonly sqlite: SqliteService) {}

  @Get()
  health() {
    const validation = validateStartupConfig();
    const status: CheckStatus = validation.ok
      ? validation.warnings.length > 0
        ? 'warn'
        : 'ok'
      : 'error';
    return {
      status,
      service: 'hi-image-studio-server',
      time: new Date().toISOString(),
      config: publicConfigSummary(),
      warnings: validation.warnings,
    };
  }

  @Get('deep')
  deepHealth() {
    const checks: Record<string, { status: CheckStatus; detail?: string }> = {};

    try {
      this.sqlite.connection.prepare('SELECT 1 AS ok').get();
      checks.sqlite = { status: 'ok' };
    } catch (error: any) {
      checks.sqlite = { status: 'error', detail: String(error?.message || error) };
    }

    try {
      checkWritableDirectory(path.dirname(config.SQLITE_FILE));
      checks.databaseDirectory = { status: 'ok' };
    } catch (error: any) {
      checks.databaseDirectory = {
        status: 'error',
        detail: String(error?.message || error),
      };
    }

    try {
      checkWritableDirectory(path.join(config.DATA_DIR, 'uploads'));
      checks.uploadsDirectory = { status: 'ok' };
    } catch (error: any) {
      checks.uploadsDirectory = {
        status: 'error',
        detail: String(error?.message || error),
      };
    }

    const validation = validateStartupConfig();
    checks.configuration = {
      status: validation.ok
        ? validation.warnings.length > 0
          ? 'warn'
          : 'ok'
        : 'error',
      detail: [...validation.issues, ...validation.warnings].join('; ') || undefined,
    };
    checks.hiapi = {
      status: config.HIAPI_API_KEY ? 'ok' : 'warn',
      detail: config.HIAPI_API_KEY ? undefined : 'HIAPI_API_KEY is not configured',
    };

    const hasError = Object.values(checks).some((check) => check.status === 'error');
    const hasWarn = Object.values(checks).some((check) => check.status === 'warn');
    return {
      status: hasError ? 'error' : hasWarn ? 'warn' : 'ok',
      service: 'hi-image-studio-server',
      time: new Date().toISOString(),
      checks,
      config: publicConfigSummary(),
    };
  }
}
