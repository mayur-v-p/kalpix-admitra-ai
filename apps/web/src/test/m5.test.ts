import { buildAdProps, phase, qrAllowed, qrPath, type AdInputs } from '@admitra/styles-engine';
import { describe, expect, it } from 'vitest';
import { isActive, qrUrlFor } from '@/features/exports/api';

const confirmed = '2026-11-26T10:00:00Z';
const snapshot = (): AdInputs => ({
  aspect: '9:16',
  watermark: true,
  productImageUrl: null,
  logoUrl: null,
  brandKit: null,
  business: { name: 'Kesar Chai House', phone: '98765 43210', phone_confirmed_at: confirmed },
  location: { address: '12 FC Road', city: 'Pune', confirmed_at: null },
  product: { name: 'Masala Chai', price: 30, price_confirmed_at: confirmed },
  campaign: {
    headline: null,
    offer_text: null,
    start_date: null,
    end_date: null,
    facts_confirmed_at: null,
    cta: 'whatsapp',
    language: 'en',
    outline_style: 'brand',
  },
  qrUrl: 'https://example.supabase.co/functions/v1/qr-redirect?c=0123456789ab',
});

// ---------------------------------------------------------------- QR code on the ad
describe('QR code on the ad', () => {
  it('appears when its target (the confirmed phone) is confirmed', () => {
    expect(buildAdProps(snapshot()).props.qrUrl).toContain('qr-redirect?c=0123456789ab');
  });

  it('is left off when the phone is not confirmed', () => {
    const s = snapshot();
    s.business.phone_confirmed_at = null;
    expect(qrAllowed(s)).toBe(false);
    expect(buildAdProps(s).props.qrUrl).toBeNull();
  });

  it('"Visit us" uses the confirmed address', () => {
    const s = snapshot();
    s.campaign.cta = 'visit';
    s.business.phone_confirmed_at = null;
    expect(qrAllowed(s)).toBe(false);
    s.location!.confirmed_at = confirmed;
    expect(qrAllowed(s)).toBe(true);
  });

  it('encodes a real, scannable QR matrix', () => {
    const { d, size } = qrPath(
      'https://example.supabase.co/functions/v1/qr-redirect?c=0123456789ab',
    );
    expect(size).toBeGreaterThanOrEqual(21); // version 1 or larger
    expect((size - 17) % 4).toBe(0); // QR sizes are 17 + 4 × version
    expect(d.startsWith('M0 0h1v1h-1z')).toBe(true); // finder pattern corner is dark
  });

  it('builds the link only from a code and the project URL', () => {
    expect(qrUrlFor(null)).toBeNull();
  });
});

// ---------------------------------------------------------------- qr-redirect target (Edge Function code)
describe('QR redirect target', async () => {
  const path = '@supabase-functions/_shared/qr-target.ts';
  const { qrTarget, phoneDigits } = (await import(/* @vite-ignore */ path)) as {
    qrTarget: (f: {
      campaignName: string;
      cta: string;
      phone: string | null;
      phoneConfirmed: boolean;
      address: { address: string; city: string; map_url: string | null } | null;
    }) => string | null;
    phoneDigits: (p: string) => string | null;
  };
  const base = {
    campaignName: 'Chai Week',
    cta: 'whatsapp',
    phone: '+91 98765 43210',
    phoneConfirmed: true,
    address: null,
  };

  it('opens WhatsApp on the confirmed number with a greeting', () => {
    expect(qrTarget(base)).toBe(
      'https://wa.me/919876543210?text=Hi!%20I%20saw%20your%20ad%3A%20Chai%20Week',
    );
  });

  it('adds +91 to 10-digit Indian numbers and rejects junk', () => {
    expect(phoneDigits('98765 43210')).toBe('919876543210');
    expect(phoneDigits('12')).toBeNull();
  });

  it('never targets an unconfirmed number', () => {
    expect(qrTarget({ ...base, phoneConfirmed: false })).toBeNull();
  });

  it('calls for "Call now" and opens the map for "Visit us"', () => {
    expect(qrTarget({ ...base, cta: 'call' })).toBe('tel:+919876543210');
    expect(
      qrTarget({
        ...base,
        cta: 'visit',
        address: { address: '12 FC Road', city: 'Pune', map_url: null },
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=12%20FC%20Road%2C%20Pune');
  });
});

// ---------------------------------------------------------------- export jobs
describe('export jobs', () => {
  it('treats queued and processing jobs as running', () => {
    expect(isActive({ status: 'QUEUED' })).toBe(true);
    expect(isActive({ status: 'PROCESSING' })).toBe(true);
    expect(isActive({ status: 'COMPLETED' })).toBe(false);
    expect(isActive({ status: 'FAILED' })).toBe(false);
    expect(isActive(null)).toBe(false);
  });

  it('takes the poster after the offer has appeared and before the closing card', () => {
    const poster = phase('offer')[1] - 1;
    expect(poster).toBeGreaterThan(phase('nameDraw')[1]);
    expect(poster).toBeLessThan(phase('endCard')[0]);
  });
});
