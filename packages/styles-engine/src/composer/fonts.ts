// Font pairs for the Composer. The font files themselves are loaded by font-files.ts (browser
// code only: the website and the worker's Remotion bundle import it; Node cannot load CSS).
import type { FontPair } from './recipe';

export type FontSpec = {
  heading: string;
  headingWeight: number;
  /** Heading font for Devanagari (Hindi/Marathi) text. */
  devHeading: string;
  devHeadingWeight: number;
  body: string;
  bodyWeight: number;
  /** Bebas-like fonts look right in capitals only. */
  capsOnly?: boolean;
  italicAccent?: boolean;
};

const SANS = "'Plus Jakarta Sans', 'Inter', 'Noto Sans Devanagari', sans-serif";

export const FONTS: Record<FontPair, FontSpec> = {
  modern: {
    heading: "'Plus Jakarta Sans', sans-serif",
    headingWeight: 800,
    devHeading: "'Baloo 2', sans-serif",
    devHeadingWeight: 800,
    body: SANS,
    bodyWeight: 500,
  },
  editorial: {
    heading: "'Playfair Display', serif",
    headingWeight: 700,
    devHeading: "'Yatra One', serif",
    devHeadingWeight: 400,
    body: SANS,
    bodyWeight: 500,
    italicAccent: true,
  },
  bold: {
    heading: "'Bebas Neue', sans-serif",
    headingWeight: 400,
    devHeading: "'Baloo 2', sans-serif",
    devHeadingWeight: 800,
    body: SANS,
    bodyWeight: 500,
    capsOnly: true,
  },
  friendly: {
    heading: "'Baloo 2', sans-serif",
    headingWeight: 800,
    devHeading: "'Baloo 2', sans-serif",
    devHeadingWeight: 800,
    body: "'Baloo 2', 'Noto Sans Devanagari', sans-serif",
    bodyWeight: 600,
  },
  elegant: {
    heading: "'Cormorant Garamond', serif",
    headingWeight: 600,
    devHeading: "'Yatra One', serif",
    devHeadingWeight: 400,
    body: SANS,
    bodyWeight: 500,
    italicAccent: true,
  },
  handwritten: {
    heading: "'Caveat', cursive",
    headingWeight: 700,
    devHeading: "'Kalam', cursive",
    devHeadingWeight: 700,
    body: SANS,
    bodyWeight: 500,
  },
};

export const isDevanagari = (s: string) => /[\u0900-\u097F]/.test(s);
