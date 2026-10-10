import { getDefaultUser } from '../../actions/db';
import RefineLoader from './RefineLoader';

// The draft is only rendered in the browser (see RefineLoader); the user's preferences it needs come
// from here
export default async function RefineHabit() {
  const user = await getDefaultUser();
  return <RefineLoader weekStartsOn={user.weekStartsOn} />;
}
