import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app-providers';
import { createQueryClient } from '@/lib/query-client';
import { routes } from '@/routes';

/** Renders the real route table at a given URL, with fresh providers for each test. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <AppProviders client={createQueryClient()}>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  };
}
