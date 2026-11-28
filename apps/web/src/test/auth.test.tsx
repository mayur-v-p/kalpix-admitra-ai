import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/features/auth/auth-schemas';
import { businessSchema, validateLogo } from '@/features/workspace/schemas';
import { renderRoute } from './render-route';
import { mockAuth } from './supabase-mock';

const signedIn = () => {
  mockAuth.session = {
    user: { id: 'u1', email: 'owner@example.com', user_metadata: { full_name: 'Asha Rao' } },
  };
};

describe('route guards', () => {
  it('sends signed-out visitors from /app to the login page', async () => {
    const { router } = renderRoute('/app/business');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 });
    expect(
      await screen.findByRole('heading', { level: 1, name: /welcome back/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('sends signed-in users from /login to the app', async () => {
    signedIn();
    const { router } = renderRoute('/login');
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/app/));
  });

  it('only redirects back into the app after login (no open redirect)', () => {
    expect(safeNextPath('/app/brand')).toBe('/app/brand');
    expect(safeNextPath('https://evil.example')).toBe('/app');
    expect(safeNextPath('//evil.example')).toBe('/app');
    expect(safeNextPath(undefined)).toBe('/app');
  });
});

describe('login', () => {
  it('validates before calling Supabase', async () => {
    const user = userEvent.setup();
    renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with email and password', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'chai1234');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'chai1234',
      options: { captchaToken: undefined }, // captcha off in tests (no site key)
    });
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/app/));
  });

  it('shows a neutral message for wrong credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' }),
    });
    const user = userEvent.setup();
    renderRoute('/login');
    await user.type(await screen.findByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
  });

  it('starts Google sign-in and returns to /app', async () => {
    const user = userEvent.setup();
    renderRoute('/login');
    await user.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
  });
});

describe('sign-up', () => {
  it('enforces the password rule and the terms checkbox', async () => {
    const user = userEvent.setup();
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Your name'), 'Asha');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'onlyletters');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Include at least one number.')).toBeInTheDocument();
    expect(screen.getByText(/accept the terms/i)).toBeInTheDocument();
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });

  it('creates the account and asks the user to confirm their email', async () => {
    const user = userEvent.setup();
    renderRoute('/signup');
    await user.type(await screen.findByLabelText('Your name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'chai1234');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'chai1234',
      options: {
        data: { full_name: 'Asha Rao' },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /check your email/i }),
    ).toBeInTheDocument();
  });
});

describe('forgot password', () => {
  it('shows the same message whether or not the account exists', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: Object.assign(new Error('User not found'), { code: 'user_not_found' }),
    });
    const user = userEvent.setup();
    renderRoute('/forgot-password');
    await user.type(await screen.findByLabelText('Email'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/if an account exists/i);
  });
});

describe('form rules match the database', () => {
  const base = {
    name: 'Kesar Chai',
    industry: 'food',
    description: '',
    phone: '',
    website: '',
    languages: ['en'],
    address: '',
    city: '',
  };

  it('accepts a minimal business and turns blanks into null', () => {
    const r = businessSchema.parse(base);
    expect(r.phone).toBeNull();
    expect(r.website).toBeNull();
  });

  it('rejects a bad phone, a link without https and an address without a city', () => {
    const r = businessSchema.safeParse({
      ...base,
      phone: 'call me',
      website: 'kesar.in',
      address: 'FC Road',
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['phone', 'website', 'city']));
  });

  it('only accepts PNG, JPG or WebP logos up to 5 MB', () => {
    expect(validateLogo(new File(['x'], 'logo.svg', { type: 'image/svg+xml' }))).toMatch(
      /PNG, JPG or WebP/,
    );
    expect(
      validateLogo(new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })),
    ).toMatch(/5 MB/);
    expect(validateLogo(new File(['x'], 'logo.png', { type: 'image/png' }))).toBeNull();
  });
});
