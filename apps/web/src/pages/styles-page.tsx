import { useMemo, useState } from 'react';
import { StyleCard } from '@/components/marketing/style-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  industryLabels,
  styleExamples,
  styleKindLabels,
  type Format,
  type Industry,
  type StyleKind,
} from '@/data/styles';

type Filters = { kind: StyleKind | 'all'; industry: Industry | 'all'; format: Format | 'all' };
const initial: Filters = { kind: 'all', industry: 'all', format: 'all' };
const formats: Format[] = ['9:16', '1:1', '4:5', '16:9'];

export function StylesPage() {
  const [filters, setFilters] = useState<Filters>(initial);

  const results = useMemo(
    () =>
      styleExamples.filter(
        (e) =>
          (filters.kind === 'all' || e.kind === filters.kind) &&
          (filters.industry === 'all' || e.industry === filters.industry) &&
          (filters.format === 'all' || e.format === filters.format),
      ),
    [filters],
  );

  return (
    <Section className="pt-8 md:pt-14">
      <Container>
        <SectionHeading
          as="h1"
          eyebrow="Style gallery"
          title="Signature styles"
          intro="Every style renders in 9:16, 1:1, 4:5 and 16:9 and ends on your brand card. Filter by style, industry or format."
        />

        <form
          className="mt-9 grid gap-4 rounded-[24px] bg-paper-deep p-5 sm:grid-cols-2 md:p-6 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Filter styles"
        >
          <FilterSelect
            label="Style"
            value={filters.kind}
            onChange={(v) => setFilters((f) => ({ ...f, kind: v as Filters['kind'] }))}
            options={Object.entries(styleKindLabels)}
          />
          <FilterSelect
            label="Industry"
            value={filters.industry}
            onChange={(v) => setFilters((f) => ({ ...f, industry: v as Filters['industry'] }))}
            options={Object.entries(industryLabels)}
          />
          <FilterSelect
            label="Format"
            value={filters.format}
            onChange={(v) => setFilters((f) => ({ ...f, format: v as Filters['format'] }))}
            options={formats.map((f) => [f, f])}
          />
          <Button variant="ghost" onClick={() => setFilters(initial)} className="w-full lg:w-auto">
            Clear filters
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? 'example' : 'examples'} shown. All businesses are
          fictional.
        </p>

        {results.length > 0 ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((example) => (
              <StyleCard key={example.id} example={example} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-line bg-card p-10 text-center">
            <p className="text-lg">No examples match these filters yet.</p>
            <Button variant="outline" className="mt-4" onClick={() => setFilters(initial)}>
              Show all styles
            </Button>
          </div>
        )}

        <div className="kx-night mt-14 flex flex-col items-start gap-5 rounded-[30px] p-8 text-white md:flex-row md:items-center md:justify-between md:p-12">
          <p className="font-display text-[clamp(26px,3vw,40px)] leading-tight font-extrabold uppercase">
            Can't decide? <span className="text-blue">Let AI</span> pick three
          </p>
          <ButtonLink to="/try" size="lg" className="kx-bluepulse w-full md:w-auto">
            Try it free
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-2xl border border-line bg-white px-3 text-base"
      >
        <option value="all">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
