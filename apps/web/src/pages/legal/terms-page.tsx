import { Link } from 'react-router-dom';
import { site } from '@/config/site';
import { LegalPage, type LegalSection } from './legal-page';

const sections: LegalSection[] = [
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        {site.name} is an online software service that helps businesses create advertising content
        (posters, ad copy and animated videos) from details and images they provide. It is a digital
        service; nothing is shipped.
      </p>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: (
      <ul>
        <li>You must give accurate information and keep your login secure.</li>
        <li>
          You are responsible for activity in your workspace, including team members you invite.
        </li>
        <li>
          You must be at least 18 years old, or use AdMitra on behalf of a business that has agreed
          to these terms.
        </li>
      </ul>
    ),
  },
  {
    id: 'plans',
    title: 'Plans, credits and auto-renewal',
    body: (
      <ul>
        <li>
          Paid plans are billed monthly in advance in Indian rupees through Razorpay, and renew
          automatically (for example through UPI Autopay) until cancelled.
        </li>
        <li>
          Each plan includes a monthly credit allowance. Credits are used when you export, not when
          you preview. Unused monthly credits do not carry over unless the plan says otherwise.
        </li>
        <li>One-time packs (such as the festival pack) are paid once and do not renew.</li>
        <li>
          We may change prices with at least 30 days&apos; notice; changes apply from your next
          billing period.
        </li>
      </ul>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content and approval',
    body: (
      <ul>
        <li>You own the photos, logos and details you upload, and the ads you export.</li>
        <li>You give us permission to process your content only to provide the service.</li>
        <li>
          AI-generated output is a draft. You must check prices, offers, dates and contact details
          before you publish an ad, and you are responsible for the ads you publish.
        </li>
        <li>Free-plan exports carry a &ldquo;Made with AdMitra&rdquo; watermark.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <ul>
        <li>
          No false or misleading claims, fake reviews, fake discounts, or claims that breach ASCI
          advertising guidelines.
        </li>
        <li>
          No content you do not have the right to use, including other brands&apos; logos or
          characters.
        </li>
        <li>No unlawful, hateful, sexual or harmful content.</li>
        <li>No attempts to break, overload or get around the security or limits of the service.</li>
      </ul>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <p>
        You can close your account at any time. We may suspend or close accounts that breach these
        terms, after notice where reasonable. On closure, your data is handled as described in the{' '}
        <Link to="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, our total
        liability for any claim is limited to the amount you paid us in the 3 months before the
        claim. We are not liable for indirect losses such as lost profits.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of India. Courts at {site.city} have jurisdiction.
        Questions: {site.supportEmail}.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPage
      title="Terms & conditions"
      intro={
        <p>
          These terms are an agreement between you and {site.legalName} for the use of {site.name}.
          By creating an account you accept them.
        </p>
      }
      sections={sections}
    />
  );
}
