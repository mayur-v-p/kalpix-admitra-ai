/**
 * Indicative plans from prd.md section 10. Prices are hypotheses to test with owners.
 * In M7 these come from the `plans` table — the browser never decides a price.
 */
export type Plan = {
  id: 'free' | 'starter' | 'growth' | 'agency';
  name: string;
  price: number;
  period: 'month' | 'forever';
  audience: string;
  features: string[];
  highlighted?: boolean;
};

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    audience: 'Try AdMitra with your own product',
    features: [
      'A few posters',
      'One short signature-style video',
      'Brand kit and product library',
      'Watermarked exports',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 399,
    period: 'month',
    audience: 'Solo local business',
    features: [
      'Monthly credits',
      'Posters and Outline Highlight videos',
      'A few AI video scenes',
      'All standard sizes, no watermark',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 899,
    period: 'month',
    audience: 'Businesses running regular campaigns',
    highlighted: true,
    features: [
      'More monthly credits',
      'All 2D signature styles and the mascot',
      'More AI video scenes',
      'Voiceover and ad variants',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 1999,
    period: 'month',
    audience: 'Freelancers and small agencies',
    features: [
      'Several client workspaces',
      'Shared assets',
      'Higher usage limits',
      'Everything in Growth',
    ],
  },
];

export const festivalPack = {
  name: 'Festival pack',
  price: 99,
  description: 'One ready-made festival campaign in several formats. Pay once, no subscription.',
};
