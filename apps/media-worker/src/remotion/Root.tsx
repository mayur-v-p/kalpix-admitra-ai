// The fonts the brand kit can choose, bundled (no font CDN), same weights as the web app.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/noto-sans-devanagari/400.css';
import {
  FORMATS,
  FPS,
  OUTLINE_HIGHLIGHT_DURATION_FRAMES,
  OutlineHighlight,
  traceImageUrl,
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

export function RenderRoot() {
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
