import { useQueryClient } from '@tanstack/react-query';
import { Check, Clapperboard, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { creditsKey } from '@/features/exports/hooks';
import { cn } from '@/lib/utils';
import {
  isClipWorking,
  reviewClip,
  SceneError,
  startAiVideo,
  type AiClip,
  type SceneType,
} from './api';
import { clipKey } from './hooks';

const errorText: Record<string, string> = {
  insufficient_credits: 'Not enough credits for a new scene.',
  rate_limited: 'You have created a lot of scenes this hour. Please try again later.',
  no_image: 'Add a product photo first.',
  invalid_scene: 'This scene is not available for your business.',
  generation_failed: 'The scene could not be started. Please try again.',
  trial_cached_only: 'AI scenes come with a free account. Save your work to use them.',
};

/**
 * AI scene for the campaign (PRD 4.3): owners pick a scene type, never write prompts. The clip
 * plays BEHIND the ad (composite mode): the real product and all text stay code-drawn. Every
 * clip needs the owner's approval before it can be exported.
 */
export function ScenePicker({
  workspaceId,
  productId,
  sceneTypes,
  clip,
  testMode,
  onSelect,
}: {
  workspaceId: string;
  productId: string | null;
  sceneTypes: SceneType[];
  clip: AiClip | null;
  testMode: boolean;
  /** Saves the campaign's scene (null = no scene). */
  onSelect: (clipId: string | null) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);

  const current = clip && clip.status !== 'FAILED' && clip.status !== 'CANCELLED' ? clip : null;
  const selected = current?.scene_type_id ?? null;

  const refreshCredits = () => queryClient.invalidateQueries({ queryKey: creditsKey(workspaceId) });

  const pick = async (sceneTypeId: string | null) => {
    setError(null);
    setRejected(false);
    setBusy(sceneTypeId ?? 'none');
    try {
      if (!sceneTypeId) {
        await onSelect(null);
      } else {
        const res = await startAiVideo(productId!, sceneTypeId);
        await onSelect(res.clipId);
        await queryClient.invalidateQueries({ queryKey: clipKey(res.clipId) });
      }
      await refreshCredits();
    } catch (e) {
      setError(
        (e instanceof SceneError && errorText[e.code]) ||
          'The scene could not be started. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const review = async (approve: boolean) => {
    if (!current) return;
    setError(null);
    setBusy(approve ? 'approve' : 'reject');
    try {
      await reviewClip(current.id, approve);
      await queryClient.invalidateQueries({ queryKey: clipKey(current.id) });
      if (!approve) {
        await onSelect(null);
        setRejected(true);
      }
    } catch {
      setError('Could not save your review. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id="scene"
      aria-labelledby="scene-heading"
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 shadow-soft"
    >
      <h2 id="scene-heading" className="font-sans text-lg font-medium tracking-normal normal-case">
        AI scene
      </h2>
      <p className="mt-1 text-sm text-muted">
        A moving background behind your ad. Your real product and all text stay exactly as they are.
        {testMode ? ' Test mode: a drawn stand-in is used instead of AI video.' : ''}
      </p>

      {!productId ? (
        <p className="mt-3 text-muted">Choose a product in the brief to add a scene.</p>
      ) : (
        <div role="radiogroup" aria-label="AI scene" className="mt-3 flex flex-col gap-2">
          {[
            { id: null, name: 'No scene', description: 'Plain brand background.', credit_cost: 0 },
            ...sceneTypes,
          ].map((t) => {
            const on = selected === t.id;
            return (
              <button
                key={t.id ?? 'none'}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={busy !== null || isClipWorking(current)}
                onClick={() => !on && pick(t.id)}
                className={cn(
                  'flex min-h-11 items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left',
                  on ? 'border-ink bg-lamp-soft' : 'border-line hover:border-ink/50',
                )}
              >
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-sm text-muted">{t.description}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {busy === (t.id ?? 'none')
                    ? 'Starting…'
                    : t.id && t.credit_cost
                      ? `${t.credit_cost} credits`
                      : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isClipWorking(current) && (
        <p className="mt-3 text-sm" aria-live="polite">
          <Clapperboard className="mr-1 inline h-4 w-4" aria-hidden="true" />
          Creating the scene… the preview already shows how it will look.
        </p>
      )}
      {current?.status === 'REVIEW_READY' && (
        <div className="mt-3">
          <FormMessage tone="info">
            Check the scene in the preview. Approve it to use it in exports.
          </FormMessage>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="dark" disabled={busy !== null} onClick={() => review(true)}>
              <Check className="h-4 w-4" aria-hidden="true" /> Approve
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => review(false)}>
              <X className="h-4 w-4" aria-hidden="true" /> Reject
            </Button>
          </div>
        </div>
      )}
      {current?.status === 'COMPLETED' && (
        <p className="mt-3 text-sm">
          <Check className="mr-1 inline h-4 w-4 text-indigo-deep" aria-hidden="true" />
          Scene approved for exports.
        </p>
      )}
      {clip?.status === 'FAILED' && !error && (
        <div className="mt-3">
          <FormMessage tone="error">
            {clip.error ?? 'The scene could not be created.'} Your credits were returned.
          </FormMessage>
        </div>
      )}
      {rejected && (
        <div className="mt-3">
          <FormMessage tone="info">
            Scene rejected. Pick it again for a new version: the first retry is free.
          </FormMessage>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
    </section>
  );
}
