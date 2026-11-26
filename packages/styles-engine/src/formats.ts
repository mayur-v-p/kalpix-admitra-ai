// Output formats (PRD 4.4: every style renders in 9:16, 1:1, 4:5 and 16:9).
export type Aspect = '9:16' | '1:1' | '4:5' | '16:9';

export const FORMATS: Record<Aspect, { width: number; height: number; label: string }> = {
  '9:16': { width: 1080, height: 1920, label: 'Status / Reel' },
  '1:1': { width: 1080, height: 1080, label: 'Square post' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait post' },
  '16:9': { width: 1920, height: 1080, label: 'Wide / YouTube' },
};

export const ASPECTS = Object.keys(FORMATS) as Aspect[];

export const FPS = 30;
