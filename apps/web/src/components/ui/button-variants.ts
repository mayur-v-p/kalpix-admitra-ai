import { cva } from 'class-variance-authority';

// Every size keeps a 44px minimum touch target (responsivness.md 2F).
export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition-[color,background-color,border-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-blue text-white hover:bg-lamp-deep',
        dark: 'bg-navy text-white hover:bg-navy-2',
        outline: 'border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink/5',
        ghost: 'bg-transparent text-ink hover:bg-ink/5',
      },
      size: {
        md: 'px-5 py-2.5 text-base',
        lg: 'px-7 py-3 text-base md:text-lg',
        icon: 'min-w-11 p-2.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
