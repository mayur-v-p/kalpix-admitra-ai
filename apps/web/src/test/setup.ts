import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { resetSupabaseMock, supabaseMock } from './supabase-mock';

// Register jest-dom matchers (toBeInTheDocument, ...) on this test run's own `expect`.
expect.extend(matchers);

// Unit tests never talk to a real Supabase project.
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock, isSupabaseConfigured: true }));

beforeEach(() => resetSupabaseMock());
afterEach(() => cleanup());

// jsdom does not implement scrolling; the layout calls window.scrollTo on navigation.
window.scrollTo = (() => {}) as typeof window.scrollTo;
