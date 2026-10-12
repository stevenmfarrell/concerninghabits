import { getDefaultUser } from '@/app/actions/user';
import Tutorial from './Tutorial';

// A walk through the app's main ideas and gestures, on made-up habits that save nothing (see
// Tutorial). Reached from Settings, and from the Agenda while it's empty.
export default async function TutorialPage() {
  const user = await getDefaultUser();

  return (
    <Tutorial
      // The demo rows' calendars are drawn on the user's own days, from one moment fixed here, so
      // the server's render and the browser's agree
      days={{ timeZone: user.timeZone, bedtime: user.bedtime, weekStartsOn: user.weekStartsOn }}
      now={new Date().getTime()}
    />
  );
}
