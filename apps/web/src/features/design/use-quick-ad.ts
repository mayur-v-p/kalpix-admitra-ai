import type { Purpose } from '@admitra/styles-engine';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsKey } from '@/features/campaigns/hooks';
import { trialLimitText } from '@/lib/trial';
import type { Tables } from '@/types/database';
import { createQuickAd, type StudioState } from './quick-ad';

/** One tap: create the ad and open the Studio, which starts designing it. */
export function useQuickAd(business: Tables<'business_profiles'> | null | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (
    purpose: Purpose,
    product?: Pick<Tables<'products'>, 'id' | 'name'> | null,
  ) => {
    if (!business) return;
    setBusy(product ? `${purpose}:${product.id}` : purpose);
    setError(null);
    try {
      const id = await createQuickAd(business, purpose, product);
      await queryClient.invalidateQueries({ queryKey: campaignsKey(business.workspace_id) });
      const state: StudioState = { autoDesign: true };
      navigate(`/app/campaigns/${id}/studio`, { state });
    } catch (e) {
      setError(trialLimitText(e) ?? 'The ad could not be started. Please try again.');
    } finally {
      setBusy(null);
    }
  };
  return { start, busy, error };
}

const FESTIVALS: Array<{ name: string; month: number; day: number }> = [
  { name: 'New Year', month: 1, day: 1 },
  { name: 'Makar Sankranti', month: 1, day: 14 },
  { name: 'Republic Day', month: 1, day: 26 },
  { name: 'Independence Day', month: 8, day: 15 },
  { name: 'Christmas', month: 12, day: 25 },
];

/** The next fixed-date festival and how many days away it is. */
export function nextFestival(today = new Date()): { name: string; days: number } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let best = { name: 'New Year', days: 400 };
  for (const f of FESTIVALS) {
    for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
      const d = new Date(year, f.month - 1, f.day);
      const days = Math.round((d.getTime() - start.getTime()) / 86_400_000);
      if (days >= 0 && days < best.days) best = { name: f.name, days };
    }
  }
  return best;
}
