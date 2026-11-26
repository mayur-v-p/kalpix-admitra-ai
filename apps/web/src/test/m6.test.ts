import { buildAdProps, type AdInputs } from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';
import { adImagePath } from '@/features/products/ad-image';
import { sceneFor, type AiClip, type SceneType } from '@/features/scenes/api';

type AiVideo = {
  buildScenePrompt: (template: string, name: string | null) => string;
  signBody: (secret: string, body: string) => Promise<string>;
  verifySignature: (secret: string, body: string, sig: string | null) => Promise<boolean>;
  safeEqual: (a: string, b: string) => boolean;
};
const path = '@supabase-functions/_shared/ai-video.ts';
const ai = (await import(/* @vite-ignore */ path)) as AiVideo;

// ---------------------------------------------------------------- prompts (Edge Function code)
describe('AI scene prompts', () => {
  const template = 'Background for {product}. No text, no numbers, no logos.';

  it('puts only the cleaned product name into the scene template', () => {
    expect(ai.buildScenePrompt(template, 'Masala Chai')).toBe(
      'Background for Masala Chai. No text, no numbers, no logos.',
    );
  });

  it('strips prices, numbers, links and symbols from the name', () => {
    const p = ai.buildScenePrompt(template, 'Chai ₹20 50% OFF http://x.io call 9876543210');
    expect(p).not.toMatch(/[0-9₹%:/]/);
    expect(p).toContain('Chai');
  });

  it('keeps Indian scripts and falls back when nothing is left', () => {
    expect(ai.buildScenePrompt(template, 'मसाला चाय')).toContain('मसाला चाय');
    expect(ai.buildScenePrompt(template, '1234')).toContain('the product');
  });
});

// ---------------------------------------------------------------- webhook signature
describe('AI video webhook signature', () => {
  const body = '{"event_id":"evt_1","job_id":"mock_1","status":"succeeded"}';

  it('accepts the provider signature and rejects tampering', async () => {
    const sig = await ai.signBody('s3cret', body);
    expect(await ai.verifySignature('s3cret', body, sig)).toBe(true);
    expect(await ai.verifySignature('s3cret', body.replace('succeeded', 'failed'), sig)).toBe(
      false,
    );
    expect(await ai.verifySignature('other', body, sig)).toBe(false);
  });

  it('rejects a missing signature or an unset secret', async () => {
    expect(await ai.verifySignature('s3cret', body, null)).toBe(false);
    expect(await ai.verifySignature('', body, 'a'.repeat(64))).toBe(false);
  });

  it('compares in constant time and checks length', () => {
    expect(ai.safeEqual('abc', 'abc')).toBe(true);
    expect(ai.safeEqual('abc', 'abd')).toBe(false);
    expect(ai.safeEqual('abc', 'abcd')).toBe(false);
  });
});

// ---------------------------------------------------------------- scene on the ad
describe('AI scene on the ad', () => {
  const type = { id: 'steam_closeup', preview_style: 'steam' } as SceneType;
  const clip = (status: string, file_path: string | null = null) =>
    ({ status, file_path, scene_type_id: 'steam_closeup' }) as AiClip;

  it('shows the scene while waiting and after approval', () => {
    expect(sceneFor(clip('PROCESSING'), type, null)).toEqual({ style: 'steam', videoUrl: null });
    expect(sceneFor(clip('COMPLETED'), type, null)).toEqual({ style: 'steam', videoUrl: null });
  });

  it('drops rejected or failed clips', () => {
    expect(sceneFor(clip('CANCELLED'), type, null)).toBeNull();
    expect(sceneFor(clip('FAILED'), type, null)).toBeNull();
  });

  it('plays the real clip when one exists', () => {
    expect(sceneFor(clip('COMPLETED', 'ws/clip.mp4'), type, 'https://signed')).toEqual({
      style: 'steam',
      videoUrl: 'https://signed',
    });
  });

  it('passes through the fact gate untouched (facts are unaffected)', () => {
    const inputs = {
      aspect: '9:16',
      watermark: true,
      productImageUrl: null,
      logoUrl: null,
      brandKit: null,
      business: { name: 'Cafe', phone: null, phone_confirmed_at: null },
      location: null,
      product: null,
      campaign: {
        headline: null,
        offer_text: '20% OFF',
        start_date: null,
        end_date: null,
        facts_confirmed_at: null,
        cta: 'whatsapp',
        language: 'en',
        outline_style: 'brand',
      },
      scene: { style: 'festive' },
    } satisfies AdInputs;
    const { props, missing } = buildAdProps(inputs);
    expect(props.scene).toEqual({ style: 'festive' });
    expect(props.facts.offer).toBeNull();
    expect(missing).toEqual(['offer']);
  });
});

// ---------------------------------------------------------------- which image ads use
describe('image used on ads', () => {
  const p = {
    image_path: 'ws/photo.jpg',
    cutout_path: 'ws/cutout.png',
    cutout_status: 'ready',
    enhanced_path: 'ws/enhanced.png',
    enhanced_status: 'ready',
    use_enhanced: false,
  };

  it('uses the cutout until the owner chooses the enhanced image', () => {
    expect(adImagePath(p)).toBe('ws/cutout.png');
    expect(adImagePath({ ...p, use_enhanced: true })).toBe('ws/enhanced.png');
  });

  it('never uses an enhanced image that is not ready', () => {
    expect(adImagePath({ ...p, use_enhanced: true, enhanced_status: 'processing' })).toBe(
      'ws/cutout.png',
    );
    expect(adImagePath({ ...p, cutout_status: 'failed' })).toBe('ws/photo.jpg');
  });
});
