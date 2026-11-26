import { ButtonLink } from '@/components/ui/button';
import { Container, Section } from '@/components/ui/container';

export function NotFoundPage() {
  return (
    <Section>
      <Container className="max-w-xl text-center">
        <p className="text-sm font-medium tracking-[0.25em] text-sage-deep uppercase">Error 404</p>
        <h1 className="mt-3 uppercase">This page is off the billboard</h1>
        <p className="mt-4 text-muted">The page you are looking for does not exist or has moved.</p>
        <ButtonLink to="/" variant="dark" className="mt-8">
          Back to home
        </ButtonLink>
      </Container>
    </Section>
  );
}
