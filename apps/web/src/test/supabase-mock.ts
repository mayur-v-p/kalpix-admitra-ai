import { vi } from 'vitest';

/**
 * In-memory stand-in for the Supabase client used by unit tests. No network calls.
 * Tests change `mockAuth.session` and the vi.fn() results to simulate each case.
 */
type Listener = (event: string, session: unknown) => void;
const listeners = new Set<Listener>();

export const mockAuth = {
  session: null as null | {
    user: { id: string; email: string; user_metadata: Record<string, unknown> };
  },
  getSession: vi.fn(async () => ({ data: { session: mockAuth.session }, error: null })),
  onAuthStateChange: vi.fn((cb: Listener) => {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  }),
  signInWithPassword: vi.fn(async () => ({ data: {}, error: null as unknown })),
  signUp: vi.fn(async () => ({
    data: { session: null } as { session: unknown },
    error: null as unknown,
  })),
  signInWithOAuth: vi.fn(async () => ({ data: {}, error: null as unknown })),
  resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null as unknown })),
  updateUser: vi.fn(async () => ({ data: {}, error: null as unknown })),
  signOut: vi.fn(async () => {
    mockAuth.session = null;
    listeners.forEach((cb) => cb('SIGNED_OUT', null));
    return { error: null };
  }),
};

export function resetSupabaseMock() {
  mockAuth.session = null;
  listeners.clear();
  for (const value of Object.values(mockAuth)) {
    if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
  }
}

/** Minimal query builder: every query resolves to { data: null, error: null } unless overridden. */
export const mockFrom = vi.fn(() => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete'])
    builder[m] = vi.fn(chain);
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  return builder;
});

export const supabaseMock = {
  auth: mockAuth,
  from: mockFrom,
  storage: { from: vi.fn() },
};
