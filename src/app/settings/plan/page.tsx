import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Calculator, Camera, ChartLine, Mic, Sparkles } from 'lucide-react';
import { getDefaultUser } from '@/app/actions/user';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PanePage, PaneSection } from '@/components/Pane';
import QuillIconWavy from '@/components/QuillIconWavy';
import { planOf, TRIAL_DAYS } from '@/lib/plans';

// What the paid plan adds: everything that makes an AI request (see aiRequestProblem)
const PAID_FEATURES: { icon: ReactNode; title: string; description: string }[] = [
  { icon: <QuillIconWavy className="w-5 h-5" />, title: 'Smart Entry', description: 'Say or type what you did, and it’s logged to the right habit' },
  { icon: <Sparkles className="w-5 h-5" />, title: 'Habit Design', description: 'Describe a habit, and its form is made for you' },
  { icon: <Mic className="w-5 h-5" />, title: 'Voice Log', description: 'Fill in an entry from what you say' },
  { icon: <Camera className="w-5 h-5" />, title: 'Photo Log', description: 'Fill in an entry from a photo' },
  { icon: <Calculator className="w-5 h-5" />, title: 'Formulas', description: 'Calculated fields written from a description' },
  { icon: <ChartLine className="w-5 h-5" />, title: 'Charts', description: 'Charts of your entries made from a description' },
];

// Plan: the hosted version's free and paid plans, and which this account is on (see plans.ts). A
// self-hosted server has no plans, so no page.
export default async function PlanPage() {
  const user = await getDefaultUser();
  const plan = planOf(user);
  if (plan.tier === 'selfhost') notFound();
  const date = (d: Date) => d.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: user.timeZone });

  let summary: string;
  switch (plan.tier) {
    case 'paid':
      summary = `You’re on the paid plan, paid through ${date(plan.until)}.`;
      break;
    case 'trial':
      summary = `You’re trying the paid plan free until ${date(plan.until)}. After that, everything but the AI features stays free.`;
      break;
    default:
      summary = plan.trialEnded
        ? `You’re on the free plan, since your free trial ended on ${date(plan.trialEnded)}. Everything but the AI features is free.`
        : 'You’re on the free plan. Everything but the AI features is free.';
  }

  return (
    <PanePage width="3xl" header={<PageHeader title="Plan" backHref="/settings" />}>
      <p className={`${PANE_INSET} py-4 text-ink-secondary`}>{summary}</p>

      <PaneSection title="Paid Features">
        {PAID_FEATURES.map(feature => (
          <div key={feature.title} className={`flex items-center gap-3 ${PANE_INSET} py-3`}>
            <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center text-accent-ink shrink-0">
              {feature.icon}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-ink">{feature.title}</div>
              <div className="text-sm text-ink-muted">{feature.description}</div>
            </div>
          </div>
        ))}
      </PaneSection>

      <p className={`${PANE_INSET} py-4 text-sm text-ink-muted`}>
        Habits, logging by hand, history, reminders and sharing are free for everyone. New accounts
        try the paid features free for {TRIAL_DAYS} days.
        {plan.tier !== 'paid' && ' Subscribing to the paid plan isn’t open yet.'}
      </p>
    </PanePage>
  );
}
