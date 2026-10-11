import { getDefaultUser } from '../../actions/db';
import { hasReminderDevice } from '../../actions/reminders';
import RefineLoader from './RefineLoader';

// The draft is only rendered in the browser (see RefineLoader); the user's preferences it needs come
// from here, with whether any of their devices get reminders, for the new habit's reminder
export default async function RefineHabit() {
  const [user, hasDevice] = await Promise.all([getDefaultUser(), hasReminderDevice()]);
  return <RefineLoader weekStartsOn={user.weekStartsOn} bedtime={user.bedtime} hasDevice={hasDevice} />;
}
