'use client';
import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, Pencil, Plus, Store, Trash2, Users } from 'lucide-react';
import { PLAN_LENGTHS, planLengthLabel, type SubscriptionPlan } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { cn, formatMoney } from '@/lib/utils';

type Length = (typeof PLAN_LENGTHS)[number];

/** A plan as the form holds it: text boxes, cleaned on save. */
export interface PlanDraft {
  /** This page's own handle for it, saved plan or new; never sent. */
  key: string;
  id?: string;
  name: string;
  description: string;
  /** One feature per line. */
  features: string;
  /** Blank: unlimited. */
  maxStores: string;
  /** Blank: that length isn't sold. */
  prices: Record<Length, string>;
  /** Blank: shops outside Nepal see the NPR price for that length. */
  pricesUsd: Record<Length, string>;
}

export const MAX_PLANS = 6;

const byLength = (f: (m: Length) => string) => Object.fromEntries(PLAN_LENGTHS.map((m) => [m, f(m)])) as Record<Length, string>;

export function toDrafts(plans: SubscriptionPlan[] | null): PlanDraft[] {
  return (plans ?? []).map((p) => ({
    key: p.id ?? p.name,
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    features: p.features.join('\n'),
    maxStores: p.maxStores === null ? '' : String(p.maxStores),
    prices: byLength((m) => String(p.prices.find((x) => x.months === m)?.amount ?? '')),
    pricesUsd: byLength((m) => String(p.prices.find((x) => x.months === m)?.amountUsd ?? '')),
  }));
}

let newCount = 0;
const blankDraft = (): PlanDraft => ({
  key: `new-${++newCount}`,
  name: '',
  description: '',
  features: '',
  maxStores: '',
  prices: byLength(() => ''),
  pricesUsd: byLength(() => ''),
});

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** What's wrong with one plan, in words an admin can act on; empty when it's fine. */
export function planProblems(d: PlanDraft, all: PlanDraft[]): string[] {
  const out: string[] = [];
  const name = d.name.trim();
  if (!name) out.push('Give it a name.');
  else if (all.some((o) => o.key !== d.key && o.name.trim().toLowerCase() === name.toLowerCase()))
    out.push('Another plan already has this name.');
  const max = num(d.maxStores);
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 1000))
    out.push('Branches: a whole number from 1 to 1000, or leave it blank for unlimited.');
  const sold = PLAN_LENGTHS.filter((m) => d.prices[m].trim() !== '');
  if (!sold.length) out.push('Set a price for at least one length.');
  if (sold.some((m) => !Number.isFinite(Number(d.prices[m])) || Number(d.prices[m]) < 10))
    out.push('Each NPR price must be at least 10.');
  if (PLAN_LENGTHS.some((m) => d.pricesUsd[m].trim() !== '' && d.prices[m].trim() === ''))
    out.push('A length with a USD price needs an NPR price too.');
  if (PLAN_LENGTHS.some((m) => d.pricesUsd[m].trim() !== '' && (!Number.isFinite(Number(d.pricesUsd[m])) || Number(d.pricesUsd[m]) < 1)))
    out.push('Each USD price must be at least 1.');
  const features = d.features.split('\n').map((f) => f.trim()).filter(Boolean);
  if (features.length > 8 || features.some((f) => f.length > 100)) out.push('Up to 8 lines of what’s included, 100 characters each.');
  return out;
}

/**
 * The drafts as the API takes them, and the first thing wrong with them if
 * any. Same key order as the API stores, so an untouched list compares equal.
 */
export function cleanPlans(drafts: PlanDraft[]): { plans: SubscriptionPlan[]; error?: string } {
  const plans = drafts.map((d) => ({
    ...(d.id ? { id: d.id } : {}),
    name: d.name.trim(),
    description: d.description.trim() || null,
    features: d.features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean),
    maxStores: num(d.maxStores),
    prices: PLAN_LENGTHS.filter((m) => d.prices[m].trim() !== '').map((m) => ({
      months: m as number,
      amount: Number(d.prices[m]),
      amountUsd: num(d.pricesUsd[m]),
    })),
  }));
  const bad = drafts.find((d) => planProblems(d, drafts).length);
  const error = bad ? `${bad.name.trim() || 'A new plan'}: ${planProblems(bad, drafts)[0]}` : undefined;
  return { plans, error };
}

// The same format the shop app shows owners (formatMoney there too).
const money = (currency: string, n: number) => formatMoney(n, currency);
const branches = (max: number | null) =>
  max === null ? 'Unlimited branches' : max === 1 ? '1 branch' : `Up to ${max} branches`;

/** "= NPR 1,900 a month · saves 5%" under a 3-month or yearly price, from what's typed. */
function priceHint(d: PlanDraft, m: Length, usd: boolean): string | null {
  const row = usd ? d.pricesUsd : d.prices;
  const price = Number(row[m]);
  if (m === 1 || !row[m].trim() || !Number.isFinite(price) || price <= 0) return null;
  const perMonth = price / m;
  const monthly = Number(row[1]);
  const saving = row[1].trim() && monthly > 0 ? Math.round((1 - price / (monthly * m)) * 100) : null;
  return `= ${money(usd ? 'USD' : 'NPR', Math.round(perMonth * 100) / 100)} a month${
    saving === null ? '' : saving > 0 ? ` · saves ${saving}%` : saving < 0 ? ' · costs more than monthly!' : ''
  }`;
}

/**
 * The plans: each a card saying what it is, how much, and how many shops are
 * on it; Edit opens its fields. Unsaved changes show on the cards as typed.
 */
export function PlansEditor({
  drafts,
  setDrafts,
  canEdit,
  usage,
}: {
  drafts: PlanDraft[];
  setDrafts: (update: (ds: PlanDraft[]) => PlanDraft[]) => void;
  canEdit: boolean;
  /** Shops on each plan, by plan id. */
  usage: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PlanDraft | null>(null);
  const patch = (key: string, next: Partial<PlanDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...next } : d)));
  const move = (i: number, by: -1 | 1) =>
    setDrafts((ds) => {
      const next = [...ds];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const remove = (key: string) => {
    setDrafts((ds) => ds.filter((d) => d.key !== key));
    if (editing === key) setEditing(null);
  };

  return (
    <div className="space-y-3">
      {drafts.length === 0 && (
        <Card className="border-dashed p-6 text-center">
          <p className="font-medium">No plans yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Owners can&apos;t subscribe or pay online until there is at least one. Start with one, e.g. &quot;Basic&quot;: 1
            branch, NPR 2,000 a month.
          </p>
        </Card>
      )}

      {drafts.map((d, i) => {
        const open = editing === d.key;
        const problems = planProblems(d, drafts);
        const shops = d.id ? (usage[d.id] ?? 0) : 0;
        const max = num(d.maxStores);
        const sold = PLAN_LENGTHS.filter((m) => d.prices[m].trim() !== '');
        const features = d.features.split('\n').map((f) => f.trim()).filter(Boolean);
        return (
          <Card
            key={d.key}
            className={cn(
              'overflow-hidden transition-all duration-150',
              // Lifts on hover, so it's clear which plan the buttons belong to; an open one stays put.
              open ? 'ring-1 ring-primary' : 'hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg',
            )}
          >
            {/* Summary: what owners will see, from what's typed. */}
            <div className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{d.name.trim() || 'New plan'}</span>
                  {!d.id && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">New, not saved</span>}
                  {problems.length > 0 && !open && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Needs fixing
                    </span>
                  )}
                </div>
                {d.description.trim() && <p className="text-xs text-muted-foreground">{d.description.trim()}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {sold.length ? (
                    sold.map((m) => (
                      <span key={m}>
                        <span className="font-semibold">{money('NPR', Number(d.prices[m]))}</span>{' '}
                        <span className="text-muted-foreground">/ {planLengthLabel(m)}</span>
                        {d.pricesUsd[m].trim() && <span className="text-muted-foreground"> ({money('USD', Number(d.pricesUsd[m]))})</span>}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No prices yet</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Store className="h-3.5 w-3.5" /> {max !== null && Number.isInteger(max) ? branches(max) : branches(null)}
                  </span>
                  {d.id && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {shops === 0 ? 'No shops on it yet' : `${shops} shop${shops === 1 ? '' : 's'} on it`}
                    </span>
                  )}
                  {features.length > 0 && <span>{features.length} thing{features.length === 1 ? '' : 's'} included</span>}
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Show earlier" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Show later"
                    disabled={i === drafts.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant={open ? 'primary' : 'outline'} size="sm" onClick={() => setEditing(open ? null : d.key)}>
                    {open ? (
                      <>
                        <Check className="h-4 w-4" /> Done
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" /> Edit
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${d.name || 'plan'}`}
                    onClick={() => (shops > 0 ? setRemoving(d) : remove(d.key))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>

            {open && <PlanFields draft={d} problems={problems} shops={shops} onChange={(next) => patch(d.key, next)} />}
          </Card>
        );
      })}

      {canEdit && drafts.length < MAX_PLANS && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const d = blankDraft();
            setDrafts((ds) => [...ds, d]);
            setEditing(d.key);
          }}
        >
          <Plus className="h-4 w-4" /> Add a plan
        </Button>
      )}
      {drafts.length >= MAX_PLANS && <p className="text-xs text-muted-foreground">Six plans at most: owners compare them side by side.</p>}

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        title={`Delete ${removing?.name || 'this plan'}?`}
        description={`${removing ? (usage[removing.id ?? ''] ?? 0) : 0} shop(s) are on it. They keep their access and paid-until date, but have no plan afterwards, so no branch limit, until they pay for another one or you move them. The plan goes when you save.`}
        confirmLabel="Delete plan"
        onConfirm={() => {
          if (removing) remove(removing.key);
          setRemoving(null);
        }}
      />
    </div>
  );
}

/** One plan's fields, with a word of help beside each. */
function PlanFields({
  draft: d,
  problems,
  shops,
  onChange,
}: {
  draft: PlanDraft;
  problems: string[];
  shops: number;
  onChange: (next: Partial<PlanDraft>) => void;
}) {
  const [usdOpen, setUsdOpen] = useState(PLAN_LENGTHS.some((m) => d.pricesUsd[m].trim() !== ''));
  return (
    <div className="space-y-5 border-t border-border bg-muted/20 p-4">
      {problems.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {problems.map((p) => (
            <p key={p}>• {p}</p>
          ))}
        </div>
      )}
      {shops > 0 && (
        <p className="rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {shops} shop{shops === 1 ? ' is' : 's are'} on this plan. A new name shows to them straight away; a new price
          applies from their next payment; a lower branch limit stops them opening more branches but closes none.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label="Plan name">
          <Input value={d.name} maxLength={40} placeholder="e.g. Business" onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Branch limit">
          <Input
            inputMode="numeric"
            value={d.maxStores}
            placeholder="Unlimited"
            onChange={(e) => onChange({ maxStores: e.target.value.replace(/[^\d]/g, '') })}
          />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The branch limit is how many stores a shop on this plan can have open. Leave it blank for no limit.
      </p>

      <Field label="Short description (optional)">
        <Input
          value={d.description}
          maxLength={200}
          placeholder="e.g. For shops with a few branches"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>

      <div>
        <p className="text-sm font-medium">Prices in NPR</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Owners choose how long to pay for. Leave a length empty if you don&apos;t sell it. Longer lengths usually cost
          less per month.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_LENGTHS.map((m) => (
            <Field key={m} label={planLengthLabel(m)}>
              <Input
                inputMode="decimal"
                value={d.prices[m]}
                placeholder="Not sold"
                onChange={(e) => onChange({ prices: { ...d.prices, [m]: e.target.value } })}
              />
              {priceHint(d, m, false) && <p className="mt-1 text-[11px] text-muted-foreground">{priceHint(d, m, false)}</p>}
            </Field>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={usdOpen} onChange={(e) => setUsdOpen(e.target.checked)} />
          Also price it in US dollars
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          For shops that keep their books in another currency. They see these prices and pay by bank or card, since eSewa,
          Khalti and connectIPS take rupees only. Without them, they see the NPR price.
        </p>
        {usdOpen && (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {PLAN_LENGTHS.map((m) => (
              <Field key={m} label={`${planLengthLabel(m)} (USD)`}>
                <Input
                  inputMode="decimal"
                  value={d.pricesUsd[m]}
                  placeholder={d.prices[m].trim() ? 'Same as NPR' : 'Not sold'}
                  disabled={!d.prices[m].trim() && !d.pricesUsd[m].trim()}
                  onChange={(e) => onChange({ pricesUsd: { ...d.pricesUsd, [m]: e.target.value } })}
                />
                {priceHint(d, m, true) && <p className="mt-1 text-[11px] text-muted-foreground">{priceHint(d, m, true)}</p>}
              </Field>
            ))}
          </div>
        )}
      </div>

      <Field label="What’s included (optional, one per line)">
        <Textarea
          rows={3}
          value={d.features}
          placeholder={'Unlimited products and staff\nStock transfers between branches\nPhone support'}
          onChange={(e) => onChange({ features: e.target.value })}
        />
      </Field>
      <p className="-mt-3 text-xs text-muted-foreground">Shown with a tick on the plan&apos;s card. Up to 8 short lines.</p>
    </div>
  );
}

/**
 * The plans as an owner sees them on their Subscription page, from what's
 * typed, so the admin can check them before saving.
 */
export function OwnerPreview({ drafts }: { drafts: PlanDraft[] }) {
  const shown = drafts.filter((d) => d.name.trim() && PLAN_LENGTHS.some((m) => d.prices[m].trim()));
  if (!shown.length) return <p className="text-sm text-muted-foreground">Nothing to show yet: a plan needs a name and a price.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {shown.map((d) => {
        const max = num(d.maxStores);
        const features = d.features.split('\n').map((f) => f.trim()).filter(Boolean);
        return (
          <div key={d.key} className="flex flex-col rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg">
            <span className="text-base font-semibold">{d.name.trim()}</span>
            {d.description.trim() && <span className="mt-0.5 text-xs text-muted-foreground">{d.description.trim()}</span>}
            <span className="mt-3 space-y-0.5">
              {PLAN_LENGTHS.filter((m) => d.prices[m].trim()).map((m) => (
                <span key={m} className="block text-sm">
                  <span className="font-semibold">{money('NPR', Number(d.prices[m]))}</span>{' '}
                  <span className="text-muted-foreground">{m === 12 ? 'a year' : m === 1 ? 'a month' : `${m} months`}</span>
                </span>
              ))}
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-xs font-medium">
              <Store className="h-3.5 w-3.5 text-primary" /> {branches(max !== null && Number.isInteger(max) ? max : null)}
            </span>
            {features.length > 0 && (
              <span className="mt-2 space-y-1">
                {features.map((f, i) => (
                  <span key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f}
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
