export type CreditPlan = 'free' | 'pro';
export type CreditAction =
  | 'prompt_enhance'
  | 'text_to_image'
  | 'image_to_image';

export type CreditPricingSettings = {
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

const DEFAULT_PRICING: CreditPricingSettings = {
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

export function costFor(
  plan: CreditPlan,
  action: CreditAction,
  pricing: CreditPricingSettings = DEFAULT_PRICING,
): number {
  const normalizedPlan: CreditPlan = plan === 'pro' ? 'pro' : 'free';
  const table: Record<CreditPlan, Record<CreditAction, number>> = {
    free: {
      prompt_enhance: Number(pricing.free.promptEnhance || 0),
      text_to_image: Number(pricing.free.textToImage || 0),
      image_to_image: Number(pricing.free.imageToImage || 0),
    },
    pro: {
      prompt_enhance: Number(pricing.pro.promptEnhance || 0),
      text_to_image: Number(pricing.pro.textToImage || 0),
      image_to_image: Number(pricing.pro.imageToImage || 0),
    },
  };

  return Math.max(0, Number(table[normalizedPlan][action] || 0));
}
