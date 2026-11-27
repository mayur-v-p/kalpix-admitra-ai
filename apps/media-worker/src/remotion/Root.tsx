// The fonts the brand kit can choose, bundled (no font CDN), same weights as the web app.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/noto-sans-devanagari/400.css';
// The Ad Composer's display fonts.
import '@admitra/styles-engine/src/composer/font-files';
import {
  Composer,
  FORMATS,
  FPS,
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  OutlineHighlight,
  surpriseRecipe,
  traceImageUrl,
  type ComposerProps,
  type OutlineHighlightProps,
} from '@admitra/styles-engine';
import { useEffect, useState } from 'react';
import { cancelRender, Composition, continueRender, delayRender } from 'remotion';

const FONT_FACES = [
  '300 48px Jost',
  '400 48px Jost',
  '500 48px Jost',
  '400 48px Inter',
  '500 48px Inter',
  '600 48px Inter',
  '400 48px "Noto Sans Devanagari"',
];

/** Holds every frame until the fonts are loaded, so no frame is drawn in a fallback font. */
function RenderAd(props: OutlineHighlightProps) {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FONT_FACES.map((f) => document.fonts.load(f, 'Kalpix अ')))
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
  return <OutlineHighlight {...props} />;
}

const placeholder: OutlineHighlightProps = {
  aspect: '9:16',
  businessName: 'Kalpix',
  headline: 'Preview',
  productName: 'Product',
  cta: 'Order now',
  facts: {},
  outlineStyle: 'brand',
  brand: {
    primary: '#1E1E1C',
    secondary: '#F6F4EF',
    accent: '#F2C94C',
    fontHeading: 'Jost',
    fontBody: 'Inter',
  },
};

// The Composer's display fonts (bundled by the styles engine).
const COMPOSER_FACES = [
  '700 48px "Playfair Display"',
  'italic 600 48px "Playfair Display"',
  '400 48px "Bebas Neue"',
  '800 48px "Baloo 2"',
  '600 48px "Baloo 2"',
  '600 48px "Cormorant Garamond"',
  'italic 500 48px "Cormorant Garamond"',
  '700 48px Caveat',
  '500 48px "Plus Jakarta Sans"',
  '700 48px "Plus Jakarta Sans"',
  '800 48px "Plus Jakarta Sans"',
  '400 48px "Yatra One"',
  '700 48px Kalam',
];

function RenderComposer(props: ComposerProps) {
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all([...FONT_FACES, ...COMPOSER_FACES].map((f) => document.fonts.load(f, 'Kalpix अ')))
      .then(() => continueRender(handle))
      .catch((e) => cancelRender(e));
  }, [handle]);
  return <Composer {...props} />;
}

const composerPlaceholder: ComposerProps = {
  aspect: '9:16',
  recipe: surpriseRecipe(1, {
    sector: 'cafe',
    purpose: 'promote',
    language: 'en',
    businessName: 'Kalpix',
    hasPhoto: false,
  }),
  ad: placeholder,
  extras: {},
};

export function RenderRoot() {
  return (
    <>
      <Composition
        id="Composer"
        component={RenderComposer}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={FORMATS['9:16'].width}
        height={FORMATS['9:16'].height}
        defaultProps={composerPlaceholder}
        calculateMetadata={({ props }) => {
          const { width, height } = FORMATS[props.aspect];
          return { width, height, durationInFrames: props.recipe.duration * FPS };
        }}
      />
      <OutlineComposition />
    </>
  );
}

function OutlineComposition() {
  return (
    <Composition
      id="OutlineHighlight"
      component={RenderAd}
      durationInFrames={OUTLINE_HIGHLIGHT_DURATION_FRAMES}
      fps={FPS}
      width={FORMATS['9:16'].width}
      height={FORMATS['9:16'].height}
      defaultProps={placeholder}
      // Runs once per size in Chromium: set the size and trace the product (same as the preview).
      calculateMetadata={async ({ props }) => {
        const { width, height } = FORMATS[props.aspect];
        const productOutline =
          props.productImageUrl && props.productOutline === undefined
            ? await traceImageUrl(props.productImageUrl)
            : (props.productOutline ?? null);
        return { width, height, props: { ...props, productOutline } };
      }}
    />
  );
}
