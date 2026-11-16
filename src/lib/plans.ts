// What each account has on the hosted version: AI features are paid for, after a free trial that
// starts when the account is made. Everything else is free. A self-hosted server has no plans, since
// AI requests there are on its owner's own keys, so everyone there has everything.
//
// Billing keeps `paidUntil` up to date (see the User model). Everything that depends on the plan asks
// here rather than reading the fields itself, so what's paid for is all decided in one place.

import { isCloud } from './deployment';
import { DAY_MS } from './timezone';

// How long a new account gets the paid features for free
export const TRIAL_DAYS = 14;

// `selfhost`: a self-hosted server, with no plans. `paid` and `trial` have the paid features until
// `until`; `free` doesn't, and `trialEnded` says when its trial did, if it had one.
export type Plan =
  | { tier: 'selfhost' }
  | { tier: 'paid' | 'trial'; until: Date }
  | { tier: 'free'; trialEnded: Date | null };

export type PlanUser = { trialEndsAt: Date | null; paidUntil: Date | null };

export function planOf(user: PlanUser, now = new Date()): Plan {
  if (!isCloud()) return { tier: 'selfhost' };
  if (user.paidUntil && user.paidUntil > now) return { tier: 'paid', until: user.paidUntil };
  if (user.trialEndsAt && user.trialEndsAt > now) return { tier: 'trial', until: user.trialEndsAt };
  return { tier: 'free', trialEnded: user.trialEndsAt };
}

// Whether `user` can use the AI features: designing habits, filling in entries from what's said,
// typed or photographed, matching smart entry to a habit, and writing formulas and charts
export function hasAi(user: PlanUser, now = new Date()) {
  return planOf(user, now).tier !== 'free';
}

// A short line saying what `plan` is, for Settings, e.g. "Free trial, 9 days left". A part of a day
// left counts as a day, so the last day says "1 day left" rather than none.
export function describePlan(plan: Plan, now = new Date()) {
  switch (plan.tier) {
    case 'selfhost': return 'Everything, on your own server';
    case 'paid': return 'Paid plan';
    case 'trial': {
      const days = Math.ceil((plan.until.getTime() - now.getTime()) / DAY_MS);
      return `Free trial, ${days} ${days === 1 ? 'day' : 'days'} left`;
    }
    case 'free': return 'Free plan';
  }
}

// When a new account's trial ends, for making it
export function newTrialEnd(now = new Date()) {
  return new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
}
