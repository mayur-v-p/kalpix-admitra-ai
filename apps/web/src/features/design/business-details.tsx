import { SECTORS, sectorOf, type Sector } from '@admitra/styles-engine';
import { SECTOR_LABELS } from './labels';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage, SelectField, TextField } from '@/components/ui/form-field';
import { supabase } from '@/lib/supabase';
import type { Business } from './api';

const REG_LABEL: Partial<Record<Sector, string>> = {
  real_estate: 'RERA registration number (required on property ads)',
  clinic: 'Clinic / doctor registration number',
  diagnostics: 'Lab registration number',
  pharmacy: 'Drug licence number',
};

/**
 * Optional details the AI designs can show: what the business is known for (words only) and
 * facts (hours, year, registration) that appear on ads only after the owner confirms them.
 */
export function BusinessDetailsCard({
  business,
  onSaved,
}: {
  business: Business;
  onSaved: () => Promise<unknown>;
}) {
  const [sector, setSector] = useState<Sector>(sectorOf(business.industry));
  const [specialities, setSpecialities] = useState((business.specialities ?? []).join(', '));
  const [hours, setHours] = useState(business.opening_hours ?? '');
  const [since, setSince] = useState(business.since_year ? String(business.since_year) : '');
  const [reg, setReg] = useState(business.registration_no ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const confirmed = Boolean(business.details_confirmed_at);
  const hasFacts = Boolean(
    business.opening_hours || business.since_year || business.registration_no,
  );
  const regLabel = REG_LABEL[sector];

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const list = specialities
        .split(/[,،\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      if (list.some((s) => s.length > 22))
        throw new Error('Keep each speciality under 22 letters.');
      const year = since.trim() ? Number(since) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1800 || year > 2100))
        throw new Error('Enter the year like 2009.');
      const { error } = await supabase
        .from('business_profiles')
        .update({
          industry: sector,
          specialities: list,
          opening_hours: hours.trim() || null,
          since_year: year,
          registration_no: regLabel ? reg.trim() || null : business.registration_no,
        })
        .eq('id', business.id);
      if (error) throw new Error('Could not save. Please check the details.');
      await onSaved();
      setMessage({ tone: 'success', text: 'Saved.' });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc('confirm_business_details', {
      p_business_id: business.id,
    });
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: 'Could not confirm. Please try again.' });
    await onSaved();
    setMessage({ tone: 'success', text: 'Confirmed. The ads can show them now.' });
  };

  return (
    <section
      className="rounded-2xl border border-line bg-card p-5 shadow-soft"
      aria-labelledby="biz-details"
    >
      <h2 id="biz-details" className="font-sans text-lg font-medium tracking-normal normal-case">
        Business details for ads
      </h2>
      <p className="mt-1 text-sm text-muted">
        The AI uses these to design ads that fit your business.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <SelectField
          id="biz-sector"
          label="Type of business"
          value={sector}
          onChange={(e) => setSector(e.target.value as Sector)}
          options={SECTORS.map((s) => ({ value: s, label: SECTOR_LABELS[s] }))}
        />
        <TextField
          id="biz-specialities"
          optional
          label="Known for (comma separated)"
          hint="Up to 8, e.g. Masala chai, Bun maska, Family seating"
          value={specialities}
          onChange={(e) => setSpecialities(e.target.value)}
        />
        <TextField
          id="biz-hours"
          optional
          label="Opening hours"
          hint="e.g. Mon–Sat · 10 AM – 9 PM"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <TextField
          id="biz-since"
          optional
          label="Since (year)"
          inputMode="numeric"
          value={since}
          onChange={(e) => setSince(e.target.value)}
        />
        {regLabel && (
          <TextField
            id="biz-reg"
            optional
            label={regLabel}
            value={reg}
            onChange={(e) => setReg(e.target.value)}
          />
        )}
        <Button type="button" variant="dark" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </Button>
        {hasFacts &&
          (confirmed ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <CheckCircle2 className="h-4 w-4 text-indigo" aria-hidden="true" /> Hours, year and
              registration are confirmed.
            </p>
          ) : (
            <div className="rounded-xl border border-lamp-deep/40 bg-lamp-soft p-3 text-sm">
              <p>
                Check the hours, year and registration number. They appear on ads only after you
                confirm them.
              </p>
              <Button type="button" className="mt-2" onClick={confirm} disabled={busy}>
                Yes, these are correct
              </Button>
            </div>
          ))}
        {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      </div>
    </section>
  );
}
