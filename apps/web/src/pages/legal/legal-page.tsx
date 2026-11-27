import type { ReactNode } from 'react';
import { Container, Section } from '@/components/ui/container';
import { site } from '@/config/site';

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Shared layout for Privacy, Terms and Refunds: title, contents list, sections.
 * The text is a starting draft and must be reviewed by a lawyer before launch.
 */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <Section className="pt-8 md:pt-14">
      <Container className="max-w-3xl">
        <h1 className="">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated: {site.lastUpdated}</p>
        <p className="mt-4 rounded-xl border border-lamp-deep/40 bg-lamp-soft p-4 text-sm">
          Draft for review: this text must be checked by a qualified lawyer before Kalpix accepts
          live payments.
        </p>
        <div className="mt-6 text-base text-ink/90 md:text-lg">{intro}</div>

        <nav aria-label="On this page" className="mt-8 rounded-2xl border border-line bg-card p-5">
          <p className="text-sm font-medium tracking-[0.2em] text-muted uppercase">On this page</p>
          <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-2xl md:text-3xl">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-ink/85 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </Section>
  );
}
