import { MAX_AI_CONTEXT_LENGTH } from '@/lib/constants';

// A user's own context for AI on a habit (see HabitMember.aiContext). Editable by everyone with the
// habit in the habit editor, owner or not, since each member keeps their own.
export default function AiContextField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="ai-context" className="block text-sm font-semibold text-stone-800">Your notes for AI</label>
      <p className="text-sm text-stone-500">
        Details that help AI recognize and fill in your entries. They&apos;re yours alone, even on a shared habit.
      </p>
      <textarea
        id="ai-context"
        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[88px] resize-y text-sm"
        placeholder={'e.g. "My bike commute is 4 miles and takes about 30 minutes."'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_AI_CONTEXT_LENGTH}
        disabled={disabled}
        autoComplete="off"
        data-1p-ignore
      />
    </div>
  );
}
