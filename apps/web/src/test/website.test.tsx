import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { safeShopName } from '@/features/auth/auth-schemas';
import { businessDefaults } from '@/features/workspace/form-defaults';
import { countValue } from '@/lib/motion';
import { renderRoute } from './render-route';
import { mockAuth } from './supabase-mock';

describe('home page (version 2)', () => {
  it('shows the headline, the sample ad and the main sections', async () => {
    renderRoute('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /ads that build themselves/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /example ad/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /why shop owners choose kalpix/i }),
    ).toBeInTheDocument();
    // Counted numbers are readable at once for screen readers.
    expect(screen.getByText('₹399')).toBeInTheDocument();
  });

  it('carries the typed shop name to sign-up', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    await user.type(await screen.findByLabelText('Your shop name'), '  Rang Boutique ');
    await user.click(screen.getByRole('button', { name: /create my first ad/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'));
    expect(router.state.location.search).toBe('?shop=Rang%20Boutique');
  });

  it('goes to sign-up without a name too', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: /create my first ad/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/signup'));
    expect(router.state.location.search).toBe('');
  });
});

describe('shop name from the home page', () => {
  it('is saved with the new account only as a display value', async () => {
    const user = userEvent.setup();
    renderRoute('/signup?shop=Rang%20Boutique');
    await user.type(await screen.findByLabelText('Your name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'chai1234');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { full_name: 'Asha Rao', shop_name: 'Rang Boutique' },
        }),
      }),
    );
  });

  it('is cleaned: trimmed, no control characters, at most 120 characters', () => {
    expect(safeShopName('  Rang Boutique ')).toBe('Rang Boutique');
    expect(safeShopName('Rang\u0000\u0007 Boutique')).toBe('Rang Boutique');
    expect(safeShopName('x'.repeat(200))).toHaveLength(120);
    expect(safeShopName('   ')).toBeNull();
    expect(safeShopName(42)).toBeNull();
  });

  it('fills the onboarding business name only when there is no saved business', () => {
    expect(businessDefaults(null, null, undefined, 'Rang Boutique').name).toBe('Rang Boutique');
    expect(
      businessDefaults({ name: 'Saved' } as never, null, undefined, 'Rang Boutique').name,
    ).toBe('Saved');
  });
});

describe('count-up animation', () => {
  it('starts at 0, ends exactly on the number and never goes past it', () => {
    expect(countValue(399, 0, 1000)).toBe(0);
    expect(countValue(399, 1000, 1000)).toBe(399);
    expect(countValue(399, 5000, 1000)).toBe(399);
    let last = 0;
    for (let t = 0; t <= 1000; t += 50) {
      const v = countValue(399, t, 1000);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});
