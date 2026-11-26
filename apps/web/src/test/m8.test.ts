import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { adminErrorText } from '@/features/admin/api';
import { captchaEnabled, useCaptcha } from '@/features/auth/captcha';
import { friendlyAuthError } from '@/features/auth/auth-errors';
import { stripQuery } from '@/lib/monitoring';
import { trialLimitText } from '@/lib/trial';

describe('free try limits', () => {
  it('explains each database limit in plain words', () => {
    expect(trialLimitText({ message: 'trial_limit', details: 'products' })).toMatch(/one product/);
    expect(trialLimitText({ message: 'trial_limit', details: 'campaigns' })).toMatch(
      /two campaigns/,
    );
    expect(trialLimitText({ message: 'trial_limit', detail: 'one_size' })).toMatch(/9:16/);
    expect(trialLimitText({ message: 'trial_limit', detail: 'daily_export' })).toMatch(
      /one export a day/,
    );
    expect(trialLimitText({ message: 'trial_limit' })).toMatch(/free try/);
  });

  it('leaves other errors alone', () => {
    expect(trialLimitText({ message: 'insufficient_credits' })).toBeNull();
    expect(trialLimitText(null)).toBeNull();
  });
});

describe('captcha', () => {
  it('is off without a site key: no widget, no token, the form may submit', () => {
    // The test environment has no VITE_TURNSTILE_SITE_KEY.
    expect(captchaEnabled).toBe(false);
    const { result } = renderHook(() => useCaptcha());
    expect(result.current.widget).toBeNull();
    expect(result.current.token).toBeUndefined();
    expect(result.current.ready).toBe(true);
  });

  it('has clear messages for captcha and free-try sign-in errors', () => {
    expect(
      friendlyAuthError({ name: 'AuthApiError', message: 'x', code: 'captcha_failed' } as Error),
    ).toMatch(/security check/);
    expect(
      friendlyAuthError({
        name: 'AuthApiError',
        message: 'x',
        code: 'anonymous_provider_disabled',
      } as Error),
    ).toMatch(/free try/);
  });
});

describe('monitoring privacy', () => {
  it('removes query strings and fragments (signed links carry tokens)', () => {
    expect(
      stripQuery('https://x.supabase.co/storage/v1/object/sign/renders/a.mp4?token=SECRET'),
    ).toBe('https://x.supabase.co/storage/v1/object/sign/renders/a.mp4');
    expect(stripQuery('http://localhost:5173/app/payment/success?ref=abc#top')).toBe(
      'http://localhost:5173/app/payment/success',
    );
  });
});

describe('admin console messages', () => {
  it('turns database codes into plain words', () => {
    expect(adminErrorText({ message: 'not_enough_credits' })).toMatch(/below zero/);
    expect(adminErrorText({ message: 'mfa_required' })).toMatch(/two-step/);
    expect(
      adminErrorText({
        message: 'new row violates check constraint "plans_razorpay_plan_id_check"',
      }),
    ).toMatch(/plan_/);
  });
});
