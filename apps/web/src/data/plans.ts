/**
 * Indicative plans from prd.md section 10, kept in step with the `plans` table seed.
 * The website shows the database rows; this copy is only shown while they load. Checkout
 * never uses these numbers: the price is Razorpay's plan, linked in the database.
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
    audience: 'Try Kalpix with your own product',
    features: [
      '10 credits to start',
      'Posters and Outline Highlight videos',
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
      '60 credits every month',
      'Posters and Outline Highlight videos',
      'AI video scenes',
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
      '150 credits every month',
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
      '400 credits every month',
      'Several client workspaces',
      'Shared assets',
      'Everything in Growth',
    ],
  },
];

export const festivalPack = {
  name: 'Festival pack',
  price: 99,
  description:
    'One festival campaign in several sizes: 15 credits and no watermark for 30 days. Pay once, no subscription.',
};
