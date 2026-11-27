import { Link } from 'react-router-dom';
import { footerNav, site } from '@/config/site';
import { Container } from '@/components/ui/container';
import { Logo } from './logo';

export function SiteFooter() {
  return (
    <footer className="bg-navy text-paper">
      <Container className="grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:py-16">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="mt-4 text-base text-paper/70">
            Speak your ad in Hindi, Marathi or English. Kalpix designs the video, poster and GIF.
            Made in India for India's shops.
          </p>
        </div>
        <FooterColumn title="Product" links={footerNav.product} />
        <FooterColumn title="Company" links={footerNav.company} />
      </Container>
      <div className="border-t border-paper/10">
        <Container className="flex flex-col gap-2 py-6 text-sm text-paper/60 sm:flex-row sm:justify-between">
          <p>&copy; 2026 {site.name}. All rights reserved.</p>
          <p>All prices in INR.</p>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ label: string; to: string }>;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium tracking-[0.2em] text-paper/60 uppercase">{title}</p>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="inline-flex min-h-11 items-center text-base text-paper/85 hover:text-lamp"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
