import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

// What's taken out of an error report before it's sent to Sentry (see errorReporting.ts), on the
// server and in the browser alike. A report says where and how something broke, never what anyone
// tracks: no request bodies, cookies or headers, no query strings, and no tokens from a path.

// Paths that carry a secret of their own, as /invite/<token> does
const SECRET_SEGMENTS = [/(\/invite\/)[^/?#]+/g];

// An address with its query and fragment removed, and any token in its path replaced
export function scrubUrl(url: string) {
  let scrubbed = url.replace(/[?#].*$/, '');
  for (const pattern of SECRET_SEGMENTS) scrubbed = scrubbed.replace(pattern, '$1[token]');
  return scrubbed;
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const key of ['url', 'from', 'to']) {
    if (typeof data[key] === 'string') data[key] = scrubUrl(data[key]);
  }
  return { ...breadcrumb, data };
}

// Sentry's beforeSend: the event as it's sent, with only the request's method and scrubbed path
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = { method: event.request.method, url: event.request.url && scrubUrl(event.request.url) };
  }
  delete event.user;
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  const requestPath = event.contexts?.nextjs?.request_path;
  if (typeof requestPath === 'string') event.contexts!.nextjs!.request_path = scrubUrl(requestPath);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  return event;
}

// What Sentry itself collects, all off: by default it gathers request headers, cookies and bodies,
// query strings, and the values of local variables in a stack trace
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

// Sentry's options for what it sends, the same on the server and in the browser. Its Console
// integration is left out: it'd attach what was logged before an error, which can be anything,
// entries and AI requests included.
export const PRIVATE_OPTIONS = {
  dataCollection: DATA_COLLECTION,
  beforeSend: scrubEvent,
  integrations: <I extends { name: string }>(defaults: I[]) => defaults.filter(integration => integration.name !== 'Console'),
};
