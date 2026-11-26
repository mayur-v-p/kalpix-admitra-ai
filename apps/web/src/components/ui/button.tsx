import type { VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button-variants';

type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

/** A router link styled as a button. */
export function ButtonLink({ className, variant, size, ...props }: LinkProps & ButtonVariants) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
