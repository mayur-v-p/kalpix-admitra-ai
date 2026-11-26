import { site } from '@/config/site';
import { LegalPage, type LegalSection } from './legal-page';

const sections: LegalSection[] = [
  {
    id: 'cancel',
    title: 'Cancelling a subscription',
    body: (
      <ul>
        <li>
          Cancel any time from the billing page in your account. Auto-renewal (including the UPI
          Autopay mandate) stops immediately.
        </li>
        <li>
          Your plan and remaining credits stay available until the end of the month you have paid
          for.
        </li>
      </ul>
    ),
  },
  {
    id: 'refunds',
    title: 'Refunds',
    body: (
      <ul>
        <li>
          First payment: if you are not satisfied, ask for a full refund within 7 days of your first
          paid month, provided you have used less than a quarter of that month&apos;s credits.
        </li>
        <li>
          Renewals: monthly renewals are not refunded on a pro-rata basis. Cancel before the renewal
          date to avoid the next charge.
        </li>
        <li>
          Charged in error (for example, a duplicate charge or a renewal after you cancelled):
          refunded in full.
        </li>
        <li>One-time packs: refundable within 7 days if none of the pack has been used.</li>
      </ul>
    ),
  },
  {
    id: 'failed-renders',
    title: 'Failed renders',
    body: (
      <p>
        Credits are reserved when you export. If a render or an AI video scene fails, the credits
        are returned to your balance automatically; you do not need to ask.
      </p>
    ),
  },
  {
    id: 'how',
    title: 'How to request a refund',
    body: (
      <p>
        Email {site.supportEmail} from your account email with the subject &ldquo;Refund
        request&rdquo; and the payment reference. Approved refunds go back to the original payment
        method through Razorpay, usually within 5–7 working days.
      </p>
    ),
  },
];

export function RefundsPage() {
  return (
    <LegalPage
      title="Refund & cancellation"
      intro={
        <p>
          {site.name} is a digital subscription service. There is no shipping or physical delivery;
          your plan is available immediately after payment is confirmed.
        </p>
      }
      sections={sections}
    />
  );
}
