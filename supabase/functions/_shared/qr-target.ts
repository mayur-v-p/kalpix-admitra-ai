// Where a QR scan goes. Pure, so it is unit-tested (apps/web/src/test/m5.test.ts).
// Same rule as qrAllowed in @admitra/styles-engine: only CONFIRMED facts give a target.

/** Indian numbers: 10 digits get the +91 country code. */
export function phoneDigits(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

type Facts = {
  campaignName: string;
  cta: string;
  phone: string | null;
  phoneConfirmed: boolean;
  address: { address: string; city: string; map_url: string | null } | null;
};

/** Where a scan goes, or null when no confirmed fact supports a target. */
export function qrTarget(f: Facts): string | null {
  const digits = f.phoneConfirmed && f.phone ? phoneDigits(f.phone) : null;
  if (f.cta === 'visit' && f.address) {
    return (
      f.address.map_url ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.address.address}, ${f.address.city}`)}`
    );
  }
  if (!digits) return null;
  if (f.cta === 'call') return `tel:+${digits}`;
  const hello = `Hi! I saw your ad: ${f.campaignName}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(hello)}`;
}
