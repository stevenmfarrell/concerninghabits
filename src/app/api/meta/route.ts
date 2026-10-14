import { version } from '../../../../package.json';
import { aiModelConfigured } from '@/lib/aiModel';
import { deploymentMode, signInMethods } from '@/lib/deployment';

// The version of the routes other apps call (see src/app/api). Raised only for a change that would
// break an app written against the old routes, so the mobile apps can tell whether they can talk to
// a server.
const API_VERSION = 1;

// What this server is and what it offers, for the mobile apps to adapt to whichever server they're
// pointed at: a self-hosted one or the hosted version. Needs no sign-in or key, so it says nothing
// about any user. Route handlers aren't cached, so it follows the server's settings as they are.
export async function GET() {
  return Response.json({
    name: 'Concerning Habits',
    version,
    apiVersion: API_VERSION,
    mode: deploymentMode(),
    signIn: signInMethods(),
    features: {
      // Designing habits and filling in entries from what's said, typed or photographed
      ai: aiModelConfigured(),
      // Publishing entries to Home Assistant
      mqtt: !!process.env.MQTT_URL,
    },
  });
}
