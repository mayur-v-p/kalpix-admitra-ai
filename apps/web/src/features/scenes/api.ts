import type { AdScene, SceneStyle } from '@admitra/styles-engine';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type SceneType = Tables<'ai_scene_types'>;
export type AiClip = Tables<'ai_video_clips'>;

export const CLIP_WORKING = ['QUEUED', 'PROCESSING'] as const;
export const isClipWorking = (c: Pick<AiClip, 'status'> | null | undefined) =>
  Boolean(c && (CLIP_WORKING as readonly string[]).includes(c.status));

export class SceneError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function listSceneTypes(industry: string): Promise<SceneType[]> {
  const { data, error } = await supabase
    .from('ai_scene_types')
    .select('*')
    .eq('active', true)
    .contains('industries', [industry])
    .order('sort');
  if (error) throw error;
  return data;
}

export async function getClip(id: string): Promise<AiClip | null> {
  const { data, error } = await supabase
    .from('ai_video_clips')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Reuses the cached clip for this product + scene, or starts a new one (credits reserved). */
export async function startAiVideo(
  productId: string,
  sceneTypeId: string,
): Promise<{ clipId: string; status: string; cached: boolean }> {
  const { data, error } = await supabase.functions.invoke('start-ai-video', {
    body: { productId, sceneTypeId, mode: 'composite' },
  });
  if (error) {
    let code = 'generation_failed';
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body && typeof body.error === 'string') code = body.error;
    }
    throw new SceneError(code);
  }
  return data;
}

export async function reviewClip(clipId: string, approve: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('review_ai_clip', {
    p_clip: clipId,
    p_approve: approve,
  });
  if (error)
    throw new SceneError(error.message === 'clip_not_ready' ? 'clip_not_ready' : 'review_failed');
  return data as string;
}

/** The scene layer for the template: the approved/awaiting clip, or its code-drawn stand-in. */
export function sceneFor(
  clip: AiClip | null | undefined,
  type: SceneType | null | undefined,
  videoUrl: string | null | undefined,
): AdScene | null {
  if (!clip || !type || clip.status === 'FAILED' || clip.status === 'CANCELLED') return null;
  return {
    style: type.preview_style as SceneStyle,
    videoUrl: clip.file_path ? (videoUrl ?? null) : null,
  };
}
