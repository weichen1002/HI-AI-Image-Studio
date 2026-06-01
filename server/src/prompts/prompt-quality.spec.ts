import { checkPromptQuality } from './prompt-quality';

describe('checkPromptQuality', () => {
  it('flags short prompts and returns a non-blocking improved draft', () => {
    const result = checkPromptQuality('咖啡');

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'too_short', severity: 'warning' }),
        expect.objectContaining({ type: 'missing_style' }),
        expect.objectContaining({ type: 'missing_composition' }),
        expect.objectContaining({ type: 'missing_lighting' }),
      ]),
    );
    expect(result.improvedPrompt).toContain('不要文字、水印、Logo');
    expect(result.billingPolicy).toContain('免费规则检查');
  });

  it('accepts detailed prompts without warnings', () => {
    const result = checkPromptQuality(
      '单个香水产品居中，商业摄影风格，纯白背景，右侧留白，柔和棚拍光，干净阴影，不要文字、水印、Logo。',
    );

    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.filter((issue) => issue.severity === 'warning')).toHaveLength(0);
  });

  it('detects contradictory instructions', () => {
    const result = checkPromptQuality(
      '写实动漫人物海报，主体居中，复杂背景，透明背景，柔和光线，不要文字。',
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'conflict',
          severity: 'warning',
        }),
      ]),
    );
  });
});
