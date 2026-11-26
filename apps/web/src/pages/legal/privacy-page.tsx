import { site } from '@/config/site';
import { LegalPage, type LegalSection } from './legal-page';

const sections: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>Account details: name, email, phone number (if you use phone sign-in), language.</li>
        <li>
          Business details you enter: business name, industry, address, contact numbers, website,
          logo, brand colours.
        </li>
        <li>
          Content you upload or create: product photos, prices, offers, campaign briefs and the ads
          we render.
        </li>
        <li>
          Billing records: plan, invoices and payment status. We do not store card or UPI details.
        </li>
        <li>
          Usage and device data: pages used, approximate city from QR scans, IP address and browser
          type, for security and abuse prevention.
        </li>
      </ul>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use it',
    body: (
      <ul>
        <li>To provide the service: create, render, store and deliver your ads.</li>
        <li>To bill you, send invoices and handle refunds.</li>
        <li>To keep the service safe: rate limits, fraud and misuse prevention.</li>
        <li>To improve Kalpix, using aggregated usage information.</li>
        <li>
          We do not sell your personal data, and we do not use your uploads to train our own AI
          models.
        </li>
      </ul>
    ),
  },
  {
    id: 'payments',
    title: 'Payments',
    body: (
      <p>
        Payments are processed by Razorpay Software Private Limited. Card, UPI and bank details are
        entered on Razorpay&apos;s secure checkout and handled under Razorpay&apos;s own privacy
        policy. We receive only the payment status, amount and reference IDs.
      </p>
    ),
  },
  {
    id: 'ai-providers',
    title: 'AI and other service providers',
    body: (
      <>
        <p>
          To create your ads we send only what each task needs to trusted processors: product photos
          for background removal and AI video scenes; campaign text for copywriting; script lines
          for voiceovers. Your prices, phone numbers and addresses are never sent to AI to rewrite.
          They are placed into the ad directly from the details you confirm.
        </p>
        <p>
          Other processors: Supabase (database, login and file storage, hosted in India), our
          hosting provider, our email/SMS provider and error monitoring. Each is bound by a contract
          to use the data only to provide its service to us.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    body: (
      <ul>
        <li>Account, business and campaign data: while your account is active.</li>
        <li>Free-try data from visitors who do not sign up: deleted after 7 days.</li>
        <li>
          After you delete your account: removed within 30 days, except records we must keep by law
          (for example GST invoices).
        </li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Under India&apos;s Digital Personal Data Protection Act, 2023 you can ask to access,
          correct or erase your personal data, withdraw consent, and name a person to act for you.
          You can export or delete your data from your profile page, or write to us.
        </p>
        <p>
          Grievance officer: {site.grievanceOfficer}, {site.supportEmail}. We respond within the
          time required by law.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Data is encrypted in transit. Each business&apos;s files and campaigns are isolated from
        every other business. Access to private files uses short-lived links, and administrator
        actions are logged.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        {site.legalName}, {site.city}. Email {site.supportEmail}.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          This policy explains what personal data {site.name} collects, why, who processes it and
          the choices you have. It applies to the website and the Kalpix app.
        </p>
      }
      sections={sections}
    />
  );
}
