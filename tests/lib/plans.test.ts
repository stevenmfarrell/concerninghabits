import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describePlan, hasAi, newTrialEnd, planOf, TRIAL_DAYS } from '@/lib/plans';
import { DAY_MS } from '@/lib/timezone';

const now = new Date('2026-10-20T12:00:00Z');
const later = (days: number) => new Date(now.getTime() + days * DAY_MS);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('planOf', () => {
  it('gives everyone everything on a self-hosted server', () => {
    const plan = planOf({ trialEndsAt: null, paidUntil: null }, now);
    expect(plan).toEqual({ tier: 'selfhost' });
    expect(hasAi({ trialEndsAt: later(-30), paidUntil: null }, now)).toBe(true);
  });

  describe('on the hosted version', () => {
    beforeEach(() => {
      vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    });

    it('has the paid features during the trial, and not after it', () => {
      expect(planOf({ trialEndsAt: later(3), paidUntil: null }, now)).toEqual({ tier: 'trial', until: later(3) });
      expect(hasAi({ trialEndsAt: later(3), paidUntil: null }, now)).toBe(true);
      expect(planOf({ trialEndsAt: now, paidUntil: null }, now)).toEqual({ tier: 'free', trialEnded: now });
      expect(hasAi({ trialEndsAt: now, paidUntil: null }, now)).toBe(false);
      expect(planOf({ trialEndsAt: null, paidUntil: null }, now)).toEqual({ tier: 'free', trialEnded: null });
    });

    it('has them while paid for, whatever the trial says', () => {
      expect(planOf({ trialEndsAt: later(3), paidUntil: later(30) }, now)).toEqual({ tier: 'paid', until: later(30) });
      expect(planOf({ trialEndsAt: later(-30), paidUntil: later(1) }, now).tier).toBe('paid');
      // Paid through a date that's passed (a subscription that ran out) leaves the trial, if any is left
      expect(planOf({ trialEndsAt: later(3), paidUntil: later(-1) }, now).tier).toBe('trial');
      expect(hasAi({ trialEndsAt: later(-30), paidUntil: later(-1) }, now)).toBe(false);
    });

    it('describes the plan, counting part of a day left as a day', () => {
      expect(describePlan(planOf({ trialEndsAt: later(TRIAL_DAYS), paidUntil: null }, now), now)).toBe(`Free trial, ${TRIAL_DAYS} days left`);
      expect(describePlan(planOf({ trialEndsAt: later(0.2), paidUntil: null }, now), now)).toBe('Free trial, 1 day left');
      expect(describePlan(planOf({ trialEndsAt: later(-1), paidUntil: null }, now), now)).toBe('Free plan');
      expect(describePlan(planOf({ trialEndsAt: null, paidUntil: later(5) }, now), now)).toBe('Paid plan');
    });
  });
});

it('starts a new account\'s trial for TRIAL_DAYS', () => {
  expect(newTrialEnd(now)).toEqual(later(TRIAL_DAYS));
});
