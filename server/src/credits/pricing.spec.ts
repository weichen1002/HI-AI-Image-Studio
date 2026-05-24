import { costFor } from './pricing';

describe('costFor', () => {
  it('returns default free plan costs', () => {
    expect(costFor('free', 'prompt_enhance')).toBe(1);
    expect(costFor('free', 'text_to_image')).toBe(2);
    expect(costFor('free', 'image_to_image')).toBe(3);
  });

  it('returns default pro plan costs', () => {
    expect(costFor('pro', 'prompt_enhance')).toBe(1);
    expect(costFor('pro', 'text_to_image')).toBe(1);
    expect(costFor('pro', 'image_to_image')).toBe(2);
  });

  it('falls back to free plan for unknown plan values', () => {
    expect(costFor('enterprise' as any, 'text_to_image')).toBe(2);
  });

  it('clamps custom negative costs to zero', () => {
    expect(
      costFor('free', 'text_to_image', {
        free: {
          promptEnhance: 1,
          textToImage: -10,
          imageToImage: 3,
        },
        pro: {
          promptEnhance: 1,
          textToImage: 1,
          imageToImage: 2,
        },
      }),
    ).toBe(0);
  });
});
