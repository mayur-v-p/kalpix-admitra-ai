import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from './render-route';

describe('public pages', () => {
  it.each([
    ['/', /ads that build/i],
    ['/styles', /signature styles/i],
    ['/pricing', /simple plans in rupees/i],
    ['/contact', /talk to us/i],
    ['/privacy', /privacy policy/i],
    ['/terms', /terms & conditions/i],
    ['/refunds', /refund & cancellation/i],
    ['/login', /welcome back/i],
    ['/signup', /create your account/i],
    ['/does-not-exist', /off the billboard/i],
  ])('%s renders its main heading', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('footer links to every legal page (Razorpay requirement)', () => {
    renderRoute('/');
    const footer = screen.getByRole('contentinfo');
    for (const name of [
      /privacy policy/i,
      /terms & conditions/i,
      /refund & cancellation/i,
      /contact us/i,
    ]) {
      expect(within(footer).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('legal pages never mention shipping', () => {
    renderRoute('/refunds');
    expect(screen.getByRole('main').textContent).not.toMatch(/shipping (charges|time|address)/i);
  });
});

describe('mobile menu', () => {
  it('opens, closes with the close button, and closes after following a link', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/');
    const toggle = screen.getByRole('button', { name: /open menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const mobileNav = screen.getByRole('navigation', { name: /mobile/i });

    await user.click(screen.getByRole('button', { name: /close menu/i }));
    expect(mobileNav).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(
      within(screen.getByRole('navigation', { name: /mobile/i })).getByRole('link', {
        name: 'Pricing',
      }),
    );
    expect(router.state.location.pathname).toBe('/pricing');
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderRoute('/');
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });
});

describe('style gallery filters', () => {
  it('filters by style and can be cleared', async () => {
    const user = userEvent.setup();
    renderRoute('/styles');
    const total = screen.getAllByRole('article').length;
    await user.selectOptions(screen.getByLabelText('Style'), 'outline');
    const outlineCount = screen.getAllByRole('article').length;
    expect(outlineCount).toBeGreaterThan(0);
    expect(outlineCount).toBeLessThan(total);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getAllByRole('article')).toHaveLength(total);
  });
});
