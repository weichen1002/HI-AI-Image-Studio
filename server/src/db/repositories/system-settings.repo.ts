import { Injectable } from '@nestjs/common';
import { config } from '../../config';
import { SqliteService } from '../sqlite.service';

const SIGNUP_BONUS_RULES_KEY = 'signup_bonus_rules';
const GENERAL_SETTINGS_KEY = 'general_settings';
const CREDIT_PRICING_KEY = 'credit_pricing';
const MODEL_SETTINGS_KEY = 'model_settings';
const UPLOAD_SETTINGS_KEY = 'upload_settings';

type SignupBonusRulesValue = {
  enabled?: boolean;
  bySource?: Record<string, unknown>;
};

type GeneralSettingsValue = {
  siteName?: unknown;
  siteSubtitle?: unknown;
  supportContact?: unknown;
  allowRegistration?: unknown;
  requireEmailVerification?: unknown;
  mailFrom?: unknown;
  mailProvider?: unknown;
  mailApiUrl?: unknown;
  mailApiKey?: unknown;
  mailSubject?: unknown;
  appBaseUrl?: unknown;
  footerCopyright?: unknown;
};

type PricingSettingsValue = {
  free?: Record<string, unknown>;
  pro?: Record<string, unknown>;
};

type ModelSettingsValue = {
  baseUrl?: unknown;
  imageModel?: unknown;
  cutoutModel?: unknown;
  textModel?: unknown;
  timeoutMs?: unknown;
  responseFormat?: unknown;
  sizeFormat?: unknown;
};

type UploadSettingsValue = {
  maxFileSizeMb?: unknown;
  allowedMimeTypes?: unknown;
};

export type SignupBonusRules = {
  enabled: boolean;
  bySource: Record<string, number>;
};

export type GeneralSettings = {
  siteName: string;
  siteSubtitle: string;
  supportContact: string;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  mailFrom: string;
  mailProvider: 'mock' | 'resend' | 'smtp-http';
  mailApiUrl: string;
  mailApiKey: string;
  mailSubject: string;
  appBaseUrl: string;
  footerCopyright: string;
};

export type PricingSettings = {
  free: {
    promptEnhance: number;
    textToImage: number;
    imageToImage: number;
  };
  pro: {
    promptEnhance: number;
    textToImage: number;
    imageToImage: number;
  };
};

export type ModelSettings = {
  baseUrl: string;
  imageModel: string;
  cutoutModel: string;
  textModel: string;
  timeoutMs: number;
  responseFormat: 'url' | 'b64_json';
  sizeFormat: 'pixel' | 'ratio';
};

export type UploadSettings = {
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
};

export const DEFAULT_SIGNUP_BONUS_RULES: SignupBonusRules = {
  enabled: true,
  bySource: {
    username: 5,
  },
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  siteName: 'Hi AI Image Studio',
  siteSubtitle: '把想法变成可以直接使用的商业图片。',
  supportContact: 'QQ 3756934376',
  allowRegistration: true,
  requireEmailVerification: false,
  mailFrom: 'no-reply@example.com',
  mailProvider: 'mock',
  mailApiUrl: '',
  mailApiKey: '',
  mailSubject: '验证你的邮箱',
  appBaseUrl: 'http://localhost:5171',
  footerCopyright: `© ${new Date().getFullYear()} Hi AI Image Studio. All rights reserved.`,
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  free: {
    promptEnhance: 1,
    textToImage: 2,
    imageToImage: 3,
  },
  pro: {
    promptEnhance: 1,
    textToImage: 1,
    imageToImage: 2,
  },
};

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  baseUrl: config.HIAPI_BASE_URL,
  imageModel: config.HIAPI_MODEL,
  cutoutModel: '',
  textModel: config.HIAPI_TEXT_MODEL,
  timeoutMs: config.HIAPI_TIMEOUT_MS,
  responseFormat:
    config.HIAPI_RESPONSE_FORMAT === 'b64_json' ? 'b64_json' : 'url',
  sizeFormat: config.HIAPI_SIZE_FORMAT === 'ratio' ? 'ratio' : 'pixel',
};

export const DEFAULT_UPLOAD_SETTINGS: UploadSettings = {
  maxFileSizeMb: Math.max(
    1,
    Math.floor(Number(config.UPLOAD_MAX_FILE_SIZE || 0) / (1024 * 1024)),
  ),
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
};

function normalizeString(value: unknown, fallback: string, max = 120) {
  const next = String(value ?? '').trim();
  if (!next) return fallback;
  return next.slice(0, max);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null) return fallback;
  return value !== false && value !== 'false' && value !== 0 && value !== '0';
}

function normalizeNonNegativeInt(
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(amount)));
}

function normalizeMimeList(value: unknown, fallback: string[]) {
  const raw = Array.isArray(value) ? value : fallback;
  const next = raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) =>
      ['image/png', 'image/jpeg', 'image/webp'].includes(item),
    );
  return next.length ? Array.from(new Set(next)) : fallback;
}

function normalizeSignupBonusRules(value: unknown): SignupBonusRules {
  const raw =
    value && typeof value === 'object'
      ? (value as SignupBonusRulesValue)
      : DEFAULT_SIGNUP_BONUS_RULES;

  const rawBySource =
    raw.bySource && typeof raw.bySource === 'object' ? raw.bySource : {};

  return {
    enabled: normalizeBoolean(raw.enabled, DEFAULT_SIGNUP_BONUS_RULES.enabled),
    bySource: {
      username: normalizeNonNegativeInt(
        rawBySource.username,
        DEFAULT_SIGNUP_BONUS_RULES.bySource.username,
        100000,
      ),
    },
  };
}

function normalizeGeneralSettings(value: unknown): GeneralSettings {
  const raw =
    value && typeof value === 'object'
      ? (value as GeneralSettingsValue)
      : DEFAULT_GENERAL_SETTINGS;

  return {
    siteName: normalizeString(raw.siteName, DEFAULT_GENERAL_SETTINGS.siteName),
    siteSubtitle: normalizeString(
      raw.siteSubtitle,
      DEFAULT_GENERAL_SETTINGS.siteSubtitle,
      200,
    ),
    supportContact: normalizeString(
      raw.supportContact,
      DEFAULT_GENERAL_SETTINGS.supportContact,
      120,
    ),
    allowRegistration: normalizeBoolean(
      raw.allowRegistration,
      DEFAULT_GENERAL_SETTINGS.allowRegistration,
    ),
    requireEmailVerification: normalizeBoolean(
      raw.requireEmailVerification,
      DEFAULT_GENERAL_SETTINGS.requireEmailVerification,
    ),
    mailFrom: normalizeString(
      raw.mailFrom,
      DEFAULT_GENERAL_SETTINGS.mailFrom,
      200,
    ),
    mailProvider:
      raw.mailProvider === 'resend' || raw.mailProvider === 'smtp-http'
        ? raw.mailProvider
        : DEFAULT_GENERAL_SETTINGS.mailProvider,
    mailApiUrl: normalizeString(
      raw.mailApiUrl,
      DEFAULT_GENERAL_SETTINGS.mailApiUrl,
      300,
    ),
    mailApiKey: normalizeString(
      raw.mailApiKey,
      DEFAULT_GENERAL_SETTINGS.mailApiKey,
      300,
    ),
    mailSubject: normalizeString(
      raw.mailSubject,
      DEFAULT_GENERAL_SETTINGS.mailSubject,
      200,
    ),
    appBaseUrl: normalizeString(
      raw.appBaseUrl,
      DEFAULT_GENERAL_SETTINGS.appBaseUrl,
      300,
    ),
    footerCopyright: normalizeString(
      raw.footerCopyright,
      DEFAULT_GENERAL_SETTINGS.footerCopyright,
      200,
    ),
  };
}

function normalizePricingSettings(value: unknown): PricingSettings {
  const raw =
    value && typeof value === 'object'
      ? (value as PricingSettingsValue)
      : DEFAULT_PRICING_SETTINGS;

  return {
    free: {
      promptEnhance: normalizeNonNegativeInt(
        raw.free?.promptEnhance,
        DEFAULT_PRICING_SETTINGS.free.promptEnhance,
        100000,
      ),
      textToImage: normalizeNonNegativeInt(
        raw.free?.textToImage,
        DEFAULT_PRICING_SETTINGS.free.textToImage,
        100000,
      ),
      imageToImage: normalizeNonNegativeInt(
        raw.free?.imageToImage,
        DEFAULT_PRICING_SETTINGS.free.imageToImage,
        100000,
      ),
    },
    pro: {
      promptEnhance: normalizeNonNegativeInt(
        raw.pro?.promptEnhance,
        DEFAULT_PRICING_SETTINGS.pro.promptEnhance,
        100000,
      ),
      textToImage: normalizeNonNegativeInt(
        raw.pro?.textToImage,
        DEFAULT_PRICING_SETTINGS.pro.textToImage,
        100000,
      ),
      imageToImage: normalizeNonNegativeInt(
        raw.pro?.imageToImage,
        DEFAULT_PRICING_SETTINGS.pro.imageToImage,
        100000,
      ),
    },
  };
}

function normalizeModelSettings(value: unknown): ModelSettings {
  const raw =
    value && typeof value === 'object'
      ? (value as ModelSettingsValue)
      : DEFAULT_MODEL_SETTINGS;

  return {
    baseUrl: normalizeString(raw.baseUrl, DEFAULT_MODEL_SETTINGS.baseUrl, 300),
    imageModel: normalizeString(
      raw.imageModel,
      DEFAULT_MODEL_SETTINGS.imageModel,
      120,
    ),
    cutoutModel: normalizeString(raw.cutoutModel, DEFAULT_MODEL_SETTINGS.cutoutModel, 120),
    textModel: normalizeString(
      raw.textModel,
      DEFAULT_MODEL_SETTINGS.textModel,
      120,
    ),
    timeoutMs: Math.max(
      5000,
      normalizeNonNegativeInt(raw.timeoutMs, DEFAULT_MODEL_SETTINGS.timeoutMs),
    ),
    responseFormat:
      raw.responseFormat === 'b64_json' ? 'b64_json' : 'url',
    sizeFormat: raw.sizeFormat === 'ratio' ? 'ratio' : 'pixel',
  };
}

function normalizeUploadSettings(value: unknown): UploadSettings {
  const raw =
    value && typeof value === 'object'
      ? (value as UploadSettingsValue)
      : DEFAULT_UPLOAD_SETTINGS;

  const envMaxMb = Math.max(
    1,
    Math.floor(Number(config.UPLOAD_MAX_FILE_SIZE || 0) / (1024 * 1024)),
  );

  return {
    maxFileSizeMb: Math.max(
      1,
      Math.min(
        envMaxMb,
        normalizeNonNegativeInt(
          raw.maxFileSizeMb,
          DEFAULT_UPLOAD_SETTINGS.maxFileSizeMb,
          envMaxMb,
        ),
      ),
    ),
    allowedMimeTypes: normalizeMimeList(
      raw.allowedMimeTypes,
      DEFAULT_UPLOAD_SETTINGS.allowedMimeTypes,
    ),
  };
}

@Injectable()
export class SystemSettingsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  getJson<T>(key: string, fallback: T): T {
    const row = this.sqlite.connection
      .prepare('SELECT value FROM system_settings WHERE key = ?')
      .get(key) as { value?: string } | undefined;

    if (!row?.value) return fallback;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  setJson(key: string, value: unknown, updatedBy: string) {
    const payload = JSON.stringify(value);
    const updatedAt = new Date().toISOString();

    this.sqlite.connection
      .prepare(
        `INSERT INTO system_settings(key, value, updated_by, updated_at)
         VALUES(?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
      )
      .run(key, payload, updatedBy, updatedAt);

    return { key, updatedBy, updatedAt };
  }

  getSignupBonusRules() {
    const value = this.getJson<SignupBonusRules>(
      SIGNUP_BONUS_RULES_KEY,
      DEFAULT_SIGNUP_BONUS_RULES,
    );
    return normalizeSignupBonusRules(value);
  }

  saveSignupBonusRules(
    value: { enabled?: boolean; usernameBonus?: unknown },
    updatedBy: string,
  ) {
    const next = normalizeSignupBonusRules({
      enabled: value.enabled,
      bySource: {
        username: value.usernameBonus,
      },
    });

    this.setJson(SIGNUP_BONUS_RULES_KEY, next, updatedBy);
    return next;
  }

  getGeneralSettings() {
    return normalizeGeneralSettings(
      this.getJson<GeneralSettings>(GENERAL_SETTINGS_KEY, DEFAULT_GENERAL_SETTINGS),
    );
  }

  saveGeneralSettings(
    value: Partial<GeneralSettings>,
    updatedBy: string,
  ) {
    const next = normalizeGeneralSettings(value);
    this.setJson(GENERAL_SETTINGS_KEY, next, updatedBy);
    return next;
  }

  getPricingSettings() {
    return normalizePricingSettings(
      this.getJson<PricingSettings>(CREDIT_PRICING_KEY, DEFAULT_PRICING_SETTINGS),
    );
  }

  savePricingSettings(
    value: Partial<PricingSettings>,
    updatedBy: string,
  ) {
    const next = normalizePricingSettings(value);
    this.setJson(CREDIT_PRICING_KEY, next, updatedBy);
    return next;
  }

  getModelSettings() {
    return normalizeModelSettings(
      this.getJson<ModelSettings>(MODEL_SETTINGS_KEY, DEFAULT_MODEL_SETTINGS),
    );
  }

  saveModelSettings(value: Partial<ModelSettings>, updatedBy: string) {
    const next = normalizeModelSettings(value);
    this.setJson(MODEL_SETTINGS_KEY, next, updatedBy);
    return next;
  }

  getUploadSettings() {
    return normalizeUploadSettings(
      this.getJson<UploadSettings>(UPLOAD_SETTINGS_KEY, DEFAULT_UPLOAD_SETTINGS),
    );
  }

  saveUploadSettings(
    value: Partial<UploadSettings>,
    updatedBy: string,
  ) {
    const next = normalizeUploadSettings(value);
    this.setJson(UPLOAD_SETTINGS_KEY, next, updatedBy);
    return next;
  }

  getAdminSettingsBootstrap() {
    return {
      general: this.getGeneralSettings(),
      signupBonus: this.getSignupBonusRules(),
      pricing: this.getPricingSettings(),
      model: this.getModelSettings(),
      upload: this.getUploadSettings(),
    };
  }

  getPublicSiteSettings() {
    const general = this.getGeneralSettings();
    return {
      siteName: general.siteName,
      siteSubtitle: general.siteSubtitle,
      supportContact: general.supportContact,
      allowRegistration: general.allowRegistration,
      requireEmailVerification: general.requireEmailVerification,
      footerCopyright: general.footerCopyright,
    };
  }
}
