import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { PublicLayout } from '@/components/layout/public-layout';
import { RedirectIfSignedIn, RequireAuth } from '@/features/auth/route-guards';
import { BrandPage } from '@/pages/app/brand-page';
import { BusinessPage } from '@/pages/app/business-page';
import { CampaignNewPage } from '@/pages/app/campaign-new-page';
import { CampaignsPage } from '@/pages/app/campaigns-page';
import { DashboardPage } from '@/pages/app/dashboard-page';
import { OnboardingPage } from '@/pages/app/onboarding-page';
import { ProductPage } from '@/pages/app/product-page';
import { ProductsPage } from '@/pages/app/products-page';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';
import { SignupPage } from '@/pages/auth/signup-page';
import { ContactPage } from '@/pages/contact-page';
import { HomePage } from '@/pages/home-page';
import { PrivacyPage } from '@/pages/legal/privacy-page';
import { RefundsPage } from '@/pages/legal/refunds-page';
import { TermsPage } from '@/pages/legal/terms-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { PricingPage } from '@/pages/pricing-page';
import { StylesPage } from '@/pages/styles-page';

/** Route table (architecture.md section 3, "Routes"). */
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'styles', element: <StylesPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'refunds', element: <RefundsPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'app',
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'onboarding', element: <OnboardingPage /> },
          { path: 'business', element: <BusinessPage /> },
          { path: 'brand', element: <BrandPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/new', element: <ProductPage /> },
          { path: 'products/:id', element: <ProductPage /> },
          { path: 'campaigns', element: <CampaignsPage /> },
          { path: 'campaigns/new', element: <CampaignNewPage /> },
          {
            // The Studio pulls in Remotion (~1 MB), so it loads only when opened.
            path: 'campaigns/:id/studio',
            lazy: async () => ({ Component: (await import('@/pages/app/studio-page')).StudioPage }),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
