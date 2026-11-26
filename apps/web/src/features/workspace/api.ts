import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { BrandFormValues, BusinessFormValues } from './schemas';

export type Workspace = Tables<'workspaces'>;
export type BusinessProfile = Tables<'business_profiles'>;
export type BusinessLocation = Tables<'business_locations'>;
export type BrandKit = Tables<'brand_kits'>;

export type WorkspaceBundle = {
  workspace: Workspace;
  role: 'owner' | 'member';
  business: BusinessProfile | null;
  location: BusinessLocation | null;
  brandKit: BrandKit | null;
};

/** Throws the Supabase error so TanStack Query can show it; never trusts silent failures. */
function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** Like check(), for queries that must return a row (insert/update ... .single()). */
function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined)
    throw new Error('The database returned no row.');
  return result.data;
}

/**
 * Loads the user's workspace with its business, first location and brand kit.
 * Row-level security limits every query to workspaces the user belongs to.
 * (One workspace per user for now; workspace switching arrives with agency accounts.)
 */
export async function fetchWorkspaceBundle(userId: string): Promise<WorkspaceBundle> {
  const membership = check(
    await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces(*)')
      .eq('user_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  );
  if (!membership?.workspace) throw new Error('No workspace found for this account.');
  const workspace = membership.workspace;

  const [business, location, brandKit] = await Promise.all([
    supabase.from('business_profiles').select('*').eq('workspace_id', workspace.id).maybeSingle(),
    supabase
      .from('business_locations')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    supabase.from('brand_kits').select('*').eq('workspace_id', workspace.id).maybeSingle(),
  ]);

  return {
    workspace,
    role: membership.role,
    business: check(business),
    location: check(location),
    brandKit: check(brandKit),
  };
}

/** Creates or updates the business and its main location. Returns the business id. */
export async function saveBusiness(
  bundle: WorkspaceBundle,
  values: BusinessFormValues,
): Promise<string> {
  const workspaceId = bundle.workspace.id;
  const fields = {
    name: values.name,
    industry: values.industry,
    description: values.description,
    phone: values.phone,
    website: values.website,
    languages: values.languages,
  };

  const business = bundle.business
    ? must(
        await supabase
          .from('business_profiles')
          .update(fields)
          .eq('id', bundle.business.id)
          .select()
          .single(),
      )
    : must(
        await supabase
          .from('business_profiles')
          .insert({ ...fields, workspace_id: workspaceId })
          .select()
          .single(),
      );

  if (values.address && values.city) {
    const place = { address: values.address, city: values.city };
    if (bundle.location) {
      check(await supabase.from('business_locations').update(place).eq('id', bundle.location.id));
    } else {
      check(
        await supabase
          .from('business_locations')
          .insert({ ...place, workspace_id: workspaceId, business_id: business.id }),
      );
    }
  } else if (bundle.location) {
    check(await supabase.from('business_locations').delete().eq('id', bundle.location.id));
  }

  // Keep the workspace name in step with the business name (owners only, by RLS).
  if (bundle.role === 'owner' && bundle.workspace.name !== values.name) {
    check(await supabase.from('workspaces').update({ name: values.name }).eq('id', workspaceId));
  }
  return business.id;
}

/** Creates or updates the brand kit. */
export async function saveBrandKit(
  bundle: WorkspaceBundle,
  businessId: string,
  values: BrandFormValues & { logo_path?: string | null },
): Promise<BrandKit> {
  if (bundle.brandKit) {
    return must(
      await supabase
        .from('brand_kits')
        .update(values)
        .eq('id', bundle.brandKit.id)
        .select()
        .single(),
    );
  }
  return must(
    await supabase
      .from('brand_kits')
      .insert({ ...values, workspace_id: bundle.workspace.id, business_id: businessId })
      .select()
      .single(),
  );
}

const extensionFor: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Uploads a logo to the private brand-assets bucket under the workspace's folder.
 * The file name is random, so user-supplied names never reach storage paths or HTML.
 */
export async function uploadLogo(workspaceId: string, file: File): Promise<string> {
  const path = `${workspaceId}/logo-${crypto.randomUUID()}.${extensionFor[file.type] ?? 'png'}`;
  check(
    await supabase.storage.from('brand-assets').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    }),
  );
  return path;
}

export type PrivateBucket = 'brand-assets' | 'product-images' | 'renders';

export async function removeFile(path: string, bucket: PrivateBucket = 'brand-assets') {
  await supabase.storage.from(bucket).remove([path]);
}

/** A short-lived link (10 minutes) for showing a private file. Storage RLS decides access. */
export async function signedUrl(
  path: string,
  bucket: PrivateBucket = 'brand-assets',
): Promise<string> {
  const data = must(await supabase.storage.from(bucket).createSignedUrl(path, 600));
  return data.signedUrl;
}
