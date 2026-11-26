/** Static demo data for the style gallery (M1). Real templates come from `style_templates` in M4. */
export type StyleKind = 'outline' | 'mascot' | 'ai-scene' | 'poster' | 'kinetic';
export type Industry = 'food' | 'retail' | 'beauty' | 'real-estate';
export type Format = '9:16' | '1:1' | '4:5' | '16:9';

export type StyleExample = {
  id: string;
  title: string;
  kind: StyleKind;
  industry: Industry;
  format: Format;
  business: string;
  offer: string;
  accent: string;
  available: 'Now' | 'Soon';
};

export const styleKindLabels: Record<StyleKind, string> = {
  outline: 'Outline Highlight',
  mascot: 'Mascot Presenter',
  'ai-scene': 'AI Scene',
  poster: 'Poster',
  kinetic: 'Kinetic Type',
};

export const industryLabels: Record<Industry, string> = {
  food: 'Restaurants & cafés',
  retail: 'Retail & fashion',
  beauty: 'Salons & beauty',
  'real-estate': 'Real estate',
};

// All businesses below are fictional examples.
export const styleExamples: StyleExample[] = [
  {
    id: 'outline-chai',
    title: 'Gold outline highlights the chai glass',
    kind: 'outline',
    industry: 'food',
    format: '9:16',
    business: 'Kesar Chai House',
    offer: '20% OFF',
    accent: '#F2C94C',
    available: 'Now',
  },
  {
    id: 'outline-kurta',
    title: 'Neon outline frames the new kurta',
    kind: 'outline',
    industry: 'retail',
    format: '1:1',
    business: 'Rangrez Studio',
    offer: 'New arrivals',
    accent: '#C76B5A',
    available: 'Now',
  },
  {
    id: 'mascot-salon',
    title: 'Mascot unveils the bridal package',
    kind: 'mascot',
    industry: 'beauty',
    format: '9:16',
    business: 'Mehndi & Mirror',
    offer: '₹2,499 package',
    accent: '#8F8FD8',
    available: 'Soon',
  },
  {
    id: 'ai-biryani',
    title: 'Steam rises over the biryani',
    kind: 'ai-scene',
    industry: 'food',
    format: '4:5',
    business: 'Dum Pukht Corner',
    offer: 'Family combo ₹599',
    accent: '#A8743F',
    available: 'Now',
  },
  {
    id: 'poster-villa',
    title: 'Split-panel listing poster',
    kind: 'poster',
    industry: 'real-estate',
    format: '16:9',
    business: 'Sahyadri Homes',
    offer: '3 BHK · 1,450 sq ft',
    accent: '#7C8C6E',
    available: 'Now',
  },
  {
    id: 'kinetic-sale',
    title: 'Diwali sale in bold kinetic type',
    kind: 'kinetic',
    industry: 'retail',
    format: '9:16',
    business: 'Lakshmi Textiles',
    offer: 'Up to 40% OFF',
    accent: '#E07A3F',
    available: 'Soon',
  },
  {
    id: 'ai-spa',
    title: 'Calm candle-lit spa scene',
    kind: 'ai-scene',
    industry: 'beauty',
    format: '1:1',
    business: 'Tulsi Spa',
    offer: 'Weekday 15% OFF',
    accent: '#7C8C6E',
    available: 'Now',
  },
  {
    id: 'poster-cafe',
    title: 'Weekend brunch poster',
    kind: 'poster',
    industry: 'food',
    format: '4:5',
    business: 'Monsoon Café',
    offer: 'Brunch ₹349',
    accent: '#F2C94C',
    available: 'Now',
  },
];
