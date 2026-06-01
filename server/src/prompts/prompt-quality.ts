export type PromptQualityIssueType =
  | 'too_short'
  | 'missing_subject'
  | 'missing_style'
  | 'missing_composition'
  | 'missing_lighting'
  | 'conflict';

export type PromptQualityIssue = {
  type: PromptQualityIssueType;
  severity: 'warning' | 'info';
  message: string;
};

export type PromptQualityResult = {
  ok: boolean;
  score: number;
  issues: PromptQualityIssue[];
  suggestions: string[];
  improvedPrompt: string;
  billingPolicy: string;
};

const SUBJECT_HINTS = [
  '人物',
  '女孩',
  '男孩',
  '女性',
  '男性',
  '商品',
  '产品',
  '海报',
  '头像',
  '场景',
  '建筑',
  '房间',
  '咖啡',
  '香水',
  '服装',
  'logo',
  '主视觉',
  'subject',
  'product',
  'portrait',
  'poster',
  'scene',
];

const STYLE_HINTS = [
  '写实',
  '摄影',
  '插画',
  '动漫',
  '3d',
  '电影',
  '极简',
  '商业',
  '复古',
  '赛博',
  '水彩',
  'realistic',
  'photo',
  'illustration',
  'cinematic',
  'minimal',
];

const COMPOSITION_HINTS = [
  '构图',
  '居中',
  '近景',
  '远景',
  '特写',
  '俯拍',
  '侧面',
  '留白',
  '背景',
  '比例',
  '视角',
  'composition',
  'centered',
  'close-up',
  'wide shot',
  'background',
  'negative space',
];

const LIGHTING_HINTS = [
  '光',
  '光线',
  '柔光',
  '自然光',
  '逆光',
  '棚拍',
  '阴影',
  '高光',
  'lighting',
  'soft light',
  'natural light',
  'studio light',
  'shadow',
];

const CONFLICTS = [
  { a: '透明背景', b: '复杂背景' },
  { a: '纯白背景', b: '黑色背景' },
  { a: '写实', b: '动漫' },
  { a: '极简', b: '复杂' },
  { a: '不要文字', b: '添加文字' },
  { a: 'no text', b: 'add text' },
  { a: 'transparent background', b: 'complex background' },
];

function includesAny(text: string, hints: string[]) {
  return hints.some((hint) => text.includes(hint.toLowerCase()));
}

function appendIfMissing(parts: string[], prompt: string, hint: string, text: string) {
  if (!prompt.includes(hint)) parts.push(text);
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

export function checkPromptQuality(promptValue: string): PromptQualityResult {
  const prompt = String(promptValue || '').trim();
  const normalized = prompt.toLowerCase();
  const issues: PromptQualityIssue[] = [];
  const suggestions: string[] = [];

  if (prompt.length < 12) {
    issues.push({
      type: 'too_short',
      severity: 'warning',
      message: '提示词过短，生成模型很难稳定理解主体和画面要求。',
    });
    suggestions.push('补充主体、用途、风格、构图和光线。');
  }

  if (!includesAny(normalized, SUBJECT_HINTS)) {
    issues.push({
      type: 'missing_subject',
      severity: 'warning',
      message: '缺少明确主体，建议写清画面核心对象或人物。',
    });
    suggestions.push('写清主体，例如“单个香水瓶”“一位穿红色外套的女性”。');
  }

  if (!includesAny(normalized, STYLE_HINTS)) {
    issues.push({
      type: 'missing_style',
      severity: 'info',
      message: '缺少风格方向，结果可能不够稳定。',
    });
    suggestions.push('加入风格，例如写实摄影、商业海报、3D 插画或电影感。');
  }

  if (!includesAny(normalized, COMPOSITION_HINTS)) {
    issues.push({
      type: 'missing_composition',
      severity: 'info',
      message: '缺少构图或背景描述，建议补充视角、留白或背景关系。',
    });
    suggestions.push('补充构图，例如主体居中、浅景深背景、右侧留白。');
  }

  if (!includesAny(normalized, LIGHTING_HINTS)) {
    issues.push({
      type: 'missing_lighting',
      severity: 'info',
      message: '缺少光线描述，画面质感可能不稳定。',
    });
    suggestions.push('补充光线，例如柔和棚拍光、自然窗光、干净阴影。');
  }

  for (const conflict of CONFLICTS) {
    if (normalized.includes(conflict.a.toLowerCase()) && normalized.includes(conflict.b.toLowerCase())) {
      issues.push({
        type: 'conflict',
        severity: 'warning',
        message: `存在可能冲突的要求：“${conflict.a}” 和 “${conflict.b}”。`,
      });
      suggestions.push('删除互相矛盾的描述，保留最重要的一种画面方向。');
    }
  }

  const improvedParts = [prompt || '清晰描述画面主体'];
  appendIfMissing(improvedParts, normalized, '不要文字', '不要文字、水印、Logo。');
  if (!includesAny(normalized, STYLE_HINTS)) {
    improvedParts.push('风格：高质量商业摄影，画面干净有质感。');
  }
  if (!includesAny(normalized, COMPOSITION_HINTS)) {
    improvedParts.push('构图：主体清晰，背景简洁，保留适度留白。');
  }
  if (!includesAny(normalized, LIGHTING_HINTS)) {
    improvedParts.push('光线：柔和自然光，阴影干净，细节清晰。');
  }

  const warningCount = issues.filter((item) => item.severity === 'warning').length;
  const score = Math.max(40, Math.min(100, 100 - warningCount * 18 - (issues.length - warningCount) * 8));

  return {
    ok: warningCount === 0,
    score,
    issues,
    suggestions: unique(suggestions),
    improvedPrompt: improvedParts.filter(Boolean).join(' '),
    billingPolicy: '免费规则检查；仅返回可选建议，不会自动覆盖原提示词，也不会阻止提交。',
  };
}
