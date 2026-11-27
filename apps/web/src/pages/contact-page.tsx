import { Mail, MapPin, Phone } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { site } from '@/config/site';

export function ContactPage() {
  const items = [
    { Icon: Mail, label: 'Email', value: site.supportEmail, href: `mailto:${site.supportEmail}` },
    {
      Icon: Phone,
      label: 'Phone',
      value: site.supportPhone,
      href: `tel:${site.supportPhone.replace(/[^+\d]/g, '')}`,
    },
    { Icon: MapPin, label: 'Business', value: `${site.legalName}, ${site.city}` },
  ];

  return (
    <Section className="pt-8 md:pt-14">
      <Container className="max-w-4xl">
        <SectionHeading
          as="h1"
          eyebrow="Contact"
          title="Talk to us"
          intro="Questions about your account, billing, refunds or a custom plan for your agency or franchise? We usually reply within one working day."
        />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map(({ Icon, label, value, href }, i) => (
            <li
              key={label}
              className={`kx-lift rounded-[28px] p-7 ${['bg-lilac', 'bg-mint', 'bg-peach'][i % 3]}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
                <Icon className="h-5 w-5 text-navy" aria-hidden="true" />
              </span>
              <p className="mt-5 font-display text-2xl font-light">{label}</p>
              {href ? (
                <a
                  href={href}
                  className="mt-1 inline-flex min-h-11 items-center text-lg break-all underline-offset-4 hover:underline"
                >
                  {value}
                </a>
              ) : (
                <p className="mt-1 text-lg">{value}</p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-muted">
          Support hours: Monday to Saturday, 10 am – 7 pm IST. For data protection requests, write
          to the email above with the subject “Privacy request”.
        </p>
      </Container>
    </Section>
  );
}
