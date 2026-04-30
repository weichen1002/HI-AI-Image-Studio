export type CreditPlan = 'free' | 'pro';
export type CreditAction =
  | 'prompt_enhance'
  | 'text_to_image'
  | 'image_to_image';

export function costFor(plan: CreditPlan, action: CreditAction): number {
  const normalizedPlan: CreditPlan = plan === 'pro' ? 'pro' : 'free';

  const table: Record<CreditPlan, Record<CreditAction, number>> = {
    free: {
      prompt_enhance: 1,
      text_to_image: 2,
      image_to_image: 3,
    },
    pro: {
      prompt_enhance: 1,
      text_to_image: 1,
      image_to_image: 2,
    },
  };

  return table[normalizedPlan][action];
}
