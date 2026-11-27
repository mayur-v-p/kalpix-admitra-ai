import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { confirmCampaignFacts, updateCampaign, type Campaign } from '@/features/campaigns/api';
import { confirmProductPrice, type Product } from '@/features/products/api';
import { inr, offerText, parseCommand, salePrice, yesOrNo, type StudioCommand } from './parse';
import { canListen, listenOnce, speak, type SpeechLang } from './speech';
import { MicDot } from './voice-panel';

const CTA_WORDS = {
  whatsapp: 'Order on WhatsApp',
  call: 'Call now',
  visit: 'Visit us today',
  book: 'Book now',
  order: 'Order now',
};
const LANG_WORDS = { en: 'English', hi: 'Hindi', mr: 'Marathi', hinglish: 'Hinglish' };

type Pending = { say: string; confirm: () => Promise<void> };

/** "20% OFF · now ₹1,200" → 20 (the discount the campaign carries today). */
const currentDiscount = (offer: string | null) =>
  Number(offer?.match(/(\d{1,2})% OFF/)?.[1] ?? 0) || undefined;

/**
 * "Change something" in the Studio: one spoken change at a time. Changes to a price or a
 * discount are read back and confirmed (the same confirmation as the forms) before the ad
 * may use them; button and language changes apply at once.
 */
export function StudioVoiceBar({
  campaign,
  product,
  onChanged,
}: {
  campaign: Campaign;
  product: Product | null;
  onChanged: () => Promise<unknown>;
}) {
  const lang: SpeechLang =
    campaign.language === 'mr' ? 'mr' : campaign.language === 'en' ? 'en' : 'hi';
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const supported = canListen();

  const apply = async (cmd: StudioCommand) => {
    const price = product?.price != null ? Number(product.price) : undefined;
    if (cmd.kind === 'discount') {
      const offer = offerText(price, cmd.value);
      await updateCampaign(campaign.id, { offer_text: offer });
      await onChanged();
      const say = price
        ? `${cmd.value}% छूट, अब ${inr(salePrice(price, cmd.value))}। सही है?`
        : `${cmd.value}% छूट। सही है?`;
      setPending({ say, confirm: async () => confirmCampaignFacts(campaign.id) });
      void speak(say, lang);
      return;
    }
    if (cmd.kind === 'price' && product) {
      const { error } = await supabase
        .from('products')
        .update({ price: cmd.value })
        .eq('id', product.id);
      if (error) throw error;
      const d = currentDiscount(campaign.offer_text);
      if (d) await updateCampaign(campaign.id, { offer_text: offerText(cmd.value, d) });
      await onChanged();
      const say = d
        ? `कीमत ${inr(cmd.value)}, ${d}% छूट के बाद ${inr(salePrice(cmd.value, d))}। सही है?`
        : `कीमत ${inr(cmd.value)}। सही है?`;
      setPending({
        say,
        confirm: async () => {
          await confirmProductPrice(product.id);
          if (d) await confirmCampaignFacts(campaign.id);
        },
      });
      void speak(say, lang);
      return;
    }
    if (cmd.kind === 'cta') {
      await updateCampaign(campaign.id, { cta: cmd.value });
      await onChanged();
      setNote(`Button changed to “${CTA_WORDS[cmd.value]}”.`);
      return;
    }
    if (cmd.kind === 'language') {
      await updateCampaign(campaign.id, { language: cmd.value });
      await onChanged();
      setNote(`Ad text changed to ${LANG_WORDS[cmd.value]}.`);
      return;
    }
    setNote(
      'Sorry, try for example: “discount 30 percent karo”, “price 1299”, “button call now”, “English mein karo”.',
    );
  };

  const run = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setNote(null);
    setPending(null);
    try {
      await apply(parseCommand(text));
    } catch {
      setNote('That change could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const listen = async () => {
    setBusy(true);
    const said = await listenOnce(lang).catch(() => '');
    setBusy(false);
    if (said) {
      setTyped(said);
      await run(said);
    } else setNote('We did not hear anything. Tap the mic and try again.');
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.confirm();
      await onChanged();
      setNote('Confirmed. The ad shows it now.');
      setPending(null);
    } catch {
      setNote('Could not confirm. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const sayYes = async () => {
    const said = await listenOnce(lang).catch(() => '');
    if (yesOrNo(said) === 'yes') await confirm();
    else if (yesOrNo(said) === 'no') setPending(null);
  };

  return (
    <section
      aria-labelledby="voice-change"
      className="rounded-3xl border border-line bg-card p-5 shadow-soft"
    >
      <h2 id="voice-change" className="font-sans text-base font-semibold tracking-normal">
        Change something
      </h2>
      <div className="mt-3 flex gap-2">
        {supported && (
          <button
            type="button"
            onClick={() => void listen()}
            disabled={busy}
            aria-label="Say a change"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lamp disabled:opacity-60"
          >
            <MicDot size="sm" />
          </button>
        )}
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(typed);
          }}
        >
          <label htmlFor="voice-change-text" className="sr-only">
            Say or type a change
          </label>
          <input
            id="voice-change-text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="e.g. discount 30 percent karo"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-base"
          />
          <button
            type="submit"
            disabled={busy || !typed.trim()}
            className="min-h-12 rounded-xl border border-ink/20 bg-card px-3 font-semibold disabled:opacity-50"
          >
            Apply
          </button>
        </form>
      </div>
      {pending && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-paper p-3">
          <p className="font-medium">{pending.say}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="min-h-11 rounded-xl bg-lamp px-4 font-bold text-ink"
            >
              हाँ, सही है
            </button>
            {supported && (
              <button
                type="button"
                onClick={() => void sayYes()}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/20 bg-card px-3 font-semibold"
              >
                <MicDot size="sm" /> Say “haan”
              </button>
            )}
            <button
              type="button"
              onClick={() => setPending(null)}
              className="min-h-11 rounded-xl border border-ink/20 bg-card px-3 font-semibold"
            >
              Not now
            </button>
          </div>
          <p className="text-xs text-muted">
            Until you confirm, this price or discount is left off the ad and downloads.
          </p>
        </div>
      )}
      {note && (
        <p role="status" className="mt-3 text-sm font-medium text-[#1E5A35]">
          {note}
        </p>
      )}
    </section>
  );
}
