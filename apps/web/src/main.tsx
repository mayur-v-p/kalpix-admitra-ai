import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Self-hosted fonts (no Google Fonts CDN, so the CSP can stay strict).
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-devanagari/400.css';
// Display face of the v3 design: thin + bold headline pairs.
import '@fontsource/inter-tight/300.css';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/inter-tight/800.css';
import './index.css';

import { AppProviders } from './app-providers';
import { initMonitoring, reportError } from './lib/monitoring';
import { routes } from './routes';

void initMonitoring();

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error) => reportError(error),
  onCaughtError: (error) => reportError(error),
}).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
