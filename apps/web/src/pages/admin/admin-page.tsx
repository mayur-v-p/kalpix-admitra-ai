import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-field';
import { getMfaState } from '@/features/account/mfa';
import { MfaChallenge } from '@/features/account/mfa-forms';
import {
  adjustCredits,
  adminErrorText,
  amIPlatformAdmin,
  auditLog,
  findUsers,
  getOverview,
  listAllSceneTypes,
  recentFailures,
  updatePlan,
  updateSceneType,
  type AdminUser,
} from '@/features/admin/api';
import { usePlans } from '@/features/billing/hooks';
import { cn, formatInr } from '@/lib/utils';
import { NotFoundPage } from '@/pages/not-found-page';
import { PageHeader, PageLoading } from '@/pages/app/page-state';

const dt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const when = (iso: string | null) => (iso ? dt.format(new Date(iso)) : '');

const tabs = ['Overview', 'Users', 'Failures', 'Plans & scenes', 'Audit log'] as const;
type Tab = (typeof tabs)[number];

/**
 * /admin: the Kalpix team's console. Only platform admins (platform_admins table) who have
 * passed two-step login in this session get data: every call is checked in the database.
 */
export function AdminPage() {
  const isAdmin = useQuery({ queryKey: ['am-i-admin'], queryFn: amIPlatformAdmin });
  const mfa = useQuery({ queryKey: ['mfa-admin'], queryFn: getMfaState, enabled: !!isAdmin.data });
  const [tab, setTab] = useState<Tab>('Overview');

  if (isAdmin.isLoading || (isAdmin.data && mfa.isLoading)) return <PageLoading />;
  if (!isAdmin.data) return <NotFoundPage />;

  if (!mfa.data?.verified)
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader eyebrow="Admin" title="Two-step login needed" />
        {mfa.data?.factorId ? (
          <MfaChallenge factorId={mfa.data.factorId} onDone={() => void mfa.refetch()} />
        ) : (
          <FormMessage tone="info">
            The admin console needs two-step login. Turn it on in{' '}
            <Link to="/app/account" className="underline">
              Account and security
            </Link>
            , then come back.
          </FormMessage>
        )}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Admin" title="Kalpix console" />
      <div
        role="tablist"
        aria-label="Admin sections"
        className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1"
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-4 whitespace-nowrap',
              tab === t ? 'bg-ink text-paper' : 'hover:bg-ink/5',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'Overview' && <Overview />}
        {tab === 'Users' && <Users />}
        {tab === 'Failures' && <Failures />}
        {tab === 'Plans & scenes' && <PlansAndScenes />}
        {tab === 'Audit log' && <Audit />}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5', warn ? 'border-red-300' : 'border-line')}>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-3xl font-light', warn && 'text-red-800')}>{value}</p>
    </div>
  );
}

function Overview() {
  const q = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getOverview,
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return <FormMessage tone="error">{adminErrorText(q.error)}</FormMessage>;
  const o = q.data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Accounts" value={o.users} />
      <Stat label="New accounts (7 days)" value={o.users_7d} />
      <Stat label="Free tries in progress" value={o.active_trials} />
      <Stat label="Paying businesses" value={o.paying_workspaces} />
      <Stat label="Revenue this month" value={formatInr(o.revenue_month_inr)} />
      <Stat label="Exports today" value={o.exports_today} />
      <Stat label="Exports waiting" value={o.exports_waiting} warn={o.exports_waiting > 10} />
      <Stat
        label="Failed exports (7 days)"
        value={o.exports_failed_7d}
        warn={o.exports_failed_7d > 0}
      />
      <Stat
        label="Average render time (7 days)"
        value={o.avg_render_seconds_7d == null ? '–' : `${o.avg_render_seconds_7d} s`}
      />
      <Stat label="AI scenes (7 days)" value={o.ai_scenes_7d} />
      <Stat
        label="Failed AI scenes (7 days)"
        value={o.ai_scenes_failed_7d}
        warn={o.ai_scenes_failed_7d > 0}
      />
      <Stat label="Webhooks (24 h)" value={o.webhooks_24h} />
      <Stat
        label="AI webhooks stuck"
        value={o.webhooks_unprocessed}
        warn={o.webhooks_unprocessed > 0}
      />
    </div>
  );
}

function Users() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const q = useQuery({ queryKey: ['admin-users', submitted], queryFn: () => findUsers(submitted) });
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <label htmlFor="user-search" className="sr-only">
          Search by email or business name
        </label>
        <input
          id="user-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email or business name"
          className="min-h-11 flex-1 rounded-full border border-line bg-paper px-4"
        />
        <Button type="submit" variant="dark">
          Search
        </Button>
      </form>
      {q.isError && <FormMessage tone="error">{adminErrorText(q.error)}</FormMessage>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[44rem] text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              <th className="p-3 font-medium">Account</th>
              <th className="p-3 font-medium">Business</th>
              <th className="p-3 font-medium">Plan</th>
              <th className="p-3 font-medium">Credits</th>
              <th className="p-3 font-medium">Exports</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(q.data ?? []).map((u) => (
              <tr key={u.user_id}>
                <td className="p-3 break-all">
                  {u.is_anonymous ? (
                    <span className="text-muted">Free try (no email)</span>
                  ) : (
                    u.email
                  )}
                </td>
                <td className="p-3">{u.business_name ?? '–'}</td>
                <td className="p-3">{u.is_trial ? 'trial' : u.plan_id}</td>
                <td className="p-3">{u.credits ?? '–'}</td>
                <td className="p-3">{u.exports}</td>
                <td className="p-3 whitespace-nowrap">{when(u.created_at)}</td>
                <td className="p-3">
                  {u.workspace_id && (
                    <Button variant="ghost" onClick={() => setSelected(u)}>
                      Credits…
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <AdjustCredits user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AdjustCredits({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => adjustCredits(user.workspace_id!, Number(amount), reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });
  const n = Number(amount);
  return (
    <section className="rounded-2xl border border-ink bg-card p-6" aria-labelledby="adjust">
      <h2 id="adjust" className="text-lg uppercase">
        Change credits: {user.business_name ?? user.email ?? 'free try'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Now {user.credits}. Use a minus sign to remove credits. The reason is saved in the audit
        log.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Credits (+ or −)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))}
            inputMode="numeric"
            className="min-h-11 w-32 rounded-xl border border-line bg-paper px-3"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            className="min-h-11 rounded-xl border border-line bg-paper px-3"
          />
        </label>
      </div>
      {m.isError && (
        <div className="mt-3">
          <FormMessage tone="error">{adminErrorText(m.error)}</FormMessage>
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <Button
          variant="dark"
          disabled={!Number.isInteger(n) || n === 0 || reason.trim().length < 3 || m.isPending}
          onClick={() => m.mutate()}
        >
          {m.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function Failures() {
  const q = useQuery({ queryKey: ['admin-failures'], queryFn: recentFailures });
  if (q.isLoading) return <PageLoading />;
  if (q.isError) return <FormMessage tone="error">{adminErrorText(q.error)}</FormMessage>;
  if (!q.data?.length) return <p className="text-muted">Nothing has failed. 🎉</p>;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
      {q.data.map((f) => (
        <li key={f.id} className="p-4">
          <p className="font-medium">
            {f.kind === 'export' ? 'Export' : 'AI scene'} · {when(f.created_at)}
            {f.attempts != null && <span className="text-muted"> · {f.attempts} attempts</span>}
          </p>
          <p className="mt-1 break-words text-muted">{f.error ?? 'No error message'}</p>
          <p className="mt-1 text-xs break-all text-muted">
            {f.id} · workspace {f.workspace_id}
          </p>
        </li>
      ))}
    </ul>
  );
}

function PlansAndScenes() {
  const queryClient = useQueryClient();
  const plans = usePlans();
  const scenes = useQuery({ queryKey: ['admin-scenes'], queryFn: listAllSceneTypes });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const savePlan = async (id: string, rzp: string, credits: number, active: boolean) => {
    setError(null);
    setSaved(null);
    try {
      await updatePlan(id, rzp, credits, active);
      setSaved(`Saved ${id}.`);
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    } catch (e) {
      setError(adminErrorText(e));
    }
  };
  const saveScene = async (id: string, active: boolean, cost: number) => {
    setError(null);
    setSaved(null);
    try {
      await updateSceneType(id, active, cost);
      setSaved(`Saved ${id}.`);
      void queryClient.invalidateQueries({ queryKey: ['admin-scenes'] });
    } catch (e) {
      setError(adminErrorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div aria-live="polite">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {saved && <FormMessage tone="success">{saved}</FormMessage>}
      </div>
      <section aria-labelledby="admin-plans">
        <h2 id="admin-plans" className="text-xl uppercase">
          Plans
        </h2>
        <p className="mt-1 text-sm text-muted">
          A price can't be changed here: it must equal the Razorpay plan's amount. For a new price,
          create a new plan in Razorpay and paste its id.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(plans.data ?? [])
            .filter((p) => p.price_inr > 0)
            .map((p) => (
              <PlanEditor key={p.id} plan={p} onSave={savePlan} />
            ))}
        </div>
      </section>
      <section aria-labelledby="admin-scenes">
        <h2 id="admin-scenes" className="text-xl uppercase">
          AI scene types
        </h2>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
          {(scenes.data ?? []).map((s) => (
            <SceneRow key={s.id} scene={s} onSave={saveScene} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: {
    id: string;
    name: string;
    price_inr: number;
    monthly_credits: number;
    razorpay_plan_id: string | null;
    active: boolean;
  };
  onSave: (id: string, rzp: string, credits: number, active: boolean) => Promise<void>;
}) {
  const [rzp, setRzp] = useState(plan.razorpay_plan_id ?? '');
  const [credits, setCredits] = useState(String(plan.monthly_credits));
  const [active, setActive] = useState(plan.active);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <p className="font-medium">
        {plan.name} · {formatInr(plan.price_inr)}/month
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Razorpay plan id</span>
        <input
          value={rzp}
          onChange={(e) => setRzp(e.target.value.trim())}
          placeholder="plan_…"
          className="min-h-11 rounded-xl border border-line bg-paper px-3"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm">Credits every month</span>
        <input
          value={credits}
          onChange={(e) => setCredits(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          className="min-h-11 w-32 rounded-xl border border-line bg-paper px-3"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5"
        />
        Shown and buyable
      </label>
      <Button
        variant="outline"
        className="w-fit"
        onClick={() => void onSave(plan.id, rzp, Number(credits), active)}
      >
        Save {plan.name}
      </Button>
    </div>
  );
}

function SceneRow({
  scene,
  onSave,
}: {
  scene: { id: string; name: string; credit_cost: number; active: boolean };
  onSave: (id: string, active: boolean, cost: number) => Promise<void>;
}) {
  const [active, setActive] = useState(scene.active);
  const [cost, setCost] = useState(String(scene.credit_cost));
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <p className="flex-1 font-medium">{scene.name}</p>
      <label className="flex items-center gap-2">
        <span className="text-sm">Credits</span>
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          className="min-h-11 w-20 rounded-xl border border-line bg-paper px-3"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5"
        />
        On
      </label>
      <Button variant="outline" onClick={() => void onSave(scene.id, active, Number(cost))}>
        Save
      </Button>
    </li>
  );
}

function Audit() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => auditLog(100) });
  if (q.isLoading) return <PageLoading />;
  if (q.isError) return <FormMessage tone="error">{adminErrorText(q.error)}</FormMessage>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[40rem] text-left">
        <thead className="border-b border-line text-sm text-muted">
          <tr>
            <th className="p-3 font-medium">When</th>
            <th className="p-3 font-medium">Who</th>
            <th className="p-3 font-medium">What</th>
            <th className="p-3 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(q.data ?? []).map((a, i) => (
            <tr key={`${a.created_at}-${i}`}>
              <td className="p-3 whitespace-nowrap">{when(a.created_at)}</td>
              <td className="p-3 break-all">{a.actor_email ?? '–'}</td>
              <td className="p-3">{a.action}</td>
              <td className="p-3 break-words text-muted">{a.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
