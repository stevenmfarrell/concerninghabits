import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PaneHeading, PanePage } from '@/components/Pane';
import CopyField from '@/components/CopyField';
import { getApiKeys } from '@/app/actions/apiKeys';
import ApiKeysClient from './ApiKeysClient';

// This server's address as the browser reached it, for the examples' URLs
async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// Inline code in the docs' text
function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs text-ink">{children}</code>;
}

// One of the API's routes: its method and path, what it does, and an example request and response.
// Text, so it sits on the stone under its heading rather than on white (see UI_STANDARDS.md).
function EndpointDoc({ title, method, path, request, response, children }: {
  title: string;
  // GET reads, so it needs a key that can read; POST logs, so it needs one that can log
  method: 'GET' | 'POST';
  path: string;
  request: string;
  response: string;
  children: ReactNode;
}) {
  return (
    <section>
      <PaneHeading>{title}</PaneHeading>
      <div className={`${PANE_INSET} py-3 space-y-3 text-sm text-ink-secondary`}>
        <p className="flex flex-wrap items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${method === 'GET' ? 'bg-category-soft-strong text-category-ink' : 'bg-accent-soft-strong text-accent-ink-strong'}`}>
            {method}
          </span>
          <code className="font-mono text-sm text-ink break-all">{path}</code>
          <span className="text-xs text-ink-muted">needs a key that can {method === 'GET' ? 'read' : 'log'}</span>
        </p>
        {children}
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-ink-muted">Example</h3>
          <CopyField label={`${title} example`} multiline value={request} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-ink-muted">Answer</h3>
          <pre className="rounded-lg bg-surface-subtle border border-line px-3 py-2.5 text-xs font-mono text-ink whitespace-pre-wrap break-all">{response}</pre>
        </div>
      </div>
    </section>
  );
}

// API Keys: keys for other apps to log and read entries as you (see src/lib/apiKeys.ts), and the
// docs for what they can do with them
export default async function ApiKeysPage() {
  const [keys, base] = await Promise.all([getApiKeys(), origin()]);
  const entry = (values: string) => `{"id": "…", "habit": {"id": "…", "name": "Run"}, "loggedAt": "2026-10-11T14:30:00.000Z", "values": ${values}}`;

  return (
    <PanePage width="3xl" header={<PageHeader title="API Keys" backHref="/settings" />}>
      <p className={`${PANE_INSET} py-3 text-ink-muted`}>
        A key lets another app, like iOS Shortcuts or Home Assistant, log entries to your habits, read their recent entries, or both, as you choose for each key. It can&apos;t change or delete anything.
      </p>

      <ApiKeysClient keys={keys} />

      <section>
        <PaneHeading>Sending Your Key</PaneHeading>
        <div className={`${PANE_INSET} py-3 space-y-2 text-sm text-ink-secondary`}>
          <p>Send it with each request in one of these ways:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><Code>Authorization: Bearer YOUR_KEY</Code></li>
            <li><Code>X-API-Key: YOUR_KEY</Code></li>
            <li>
              <Code>?key=YOUR_KEY</Code> at the end of the address, for an app that can&apos;t send headers. Anyone who sees an address like that can use the key, so keep it private.
            </li>
          </ul>
          <p className="text-ink-muted">
            A habit&apos;s id is in its page&apos;s address, after <Code>/log/</Code>. Its ⋮ menu → Log from Another App has its full address and field names. A key can make 600 requests an hour. One used for something it isn&apos;t allowed gets a 403.
          </p>
        </div>
      </section>

      <EndpointDoc
        title="Log by Saying What You Did"
        method="POST"
        path="/api/log"
        request={`curl -X POST ${base}/api/log \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -d '{"text": "ran 3 miles in 25 minutes"}'`}
        response={`201 ${entry('{"distance": 3, "duration": 25}')}`}
      >
        <p>
          Say what you did in your own words. AI works out which habit it was and fills in the details, like the Agenda&apos;s &ldquo;I did&hellip;&rdquo; button. One shortcut that asks &ldquo;What did you do?&rdquo; can cover every habit.
        </p>
        <p className="text-ink-muted">
          It only logs to a habit it&apos;s sure about, and never makes a new one. Otherwise it logs nothing and answers 422 with the habits it thought of, as <Code>candidates</Code>. Add <Code>&quot;at&quot;</Code>, a date and time like <Code>&quot;2026-10-11T07:30:00-07:00&quot;</Code>, for something done earlier. Each request counts toward your hourly AI limit.
        </p>
      </EndpointDoc>

      <EndpointDoc
        title="Log a Habit"
        method="POST"
        path="/api/habits/HABIT_ID/log"
        request={`curl -X POST ${base}/api/habits/HABIT_ID/log \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -d '{"values": {"distance": 3, "duration": 25}}'`}
        response={`201 ${entry('{"distance": 3, "duration": 25}')}`}
      >
        <p>
          Logs one habit. Send its fields under <Code>&quot;values&quot;</Code> by their names. A duration is in minutes, and a number or yes-or-no can be sent as text. Or send <Code>&quot;text&quot;</Code> in your own words for AI to fill them in, alongside any values you know.
        </p>
        <p className="text-ink-muted">
          A habit with no fields needs no body at all. Add <Code>&quot;at&quot;</Code> for something done earlier. Values the habit doesn&apos;t take get a 400 that names the ones it does.
        </p>
      </EndpointDoc>

      <EndpointDoc
        title="A Habit's Entries"
        method="GET"
        path="/api/habits/HABIT_ID/entries?limit=10"
        request={`curl "${base}/api/habits/HABIT_ID/entries?limit=10" \\\n  -H "Authorization: Bearer YOUR_KEY"`}
        response={`200 {"habit": {"id": "…", "name": "Run"}, "entries": [\n  {"id": "…", "loggedAt": "2026-10-11T14:30:00.000Z", "values": {"distance": 3}, "loggedBy": {"id": "…", "name": "Sam"}}\n]}`}
      >
        <p>
          A habit&apos;s latest entries, newest first: <Code>limit</Code> of them, from 1 to 100 (10 if you leave it out). On a shared habit that&apos;s everyone&apos;s entries, each with who logged it.
        </p>
      </EndpointDoc>
    </PanePage>
  );
}
