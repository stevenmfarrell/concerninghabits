import { afterEach, describe, expect, it, vi } from 'vitest';
import { deploymentMode, isCloud } from '@/lib/deployment';
import { GET as meta } from '@/app/api/meta/route';
import { version } from '../../package.json';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('deploymentMode', () => {
  it('is self-hosted unless set to cloud', () => {
    vi.stubEnv('DEPLOYMENT_MODE', '');
    expect(deploymentMode()).toBe('selfhost');
    expect(isCloud()).toBe(false);

    vi.stubEnv('DEPLOYMENT_MODE', ' Cloud ');
    expect(deploymentMode()).toBe('cloud');
    expect(isCloud()).toBe(true);

    vi.stubEnv('DEPLOYMENT_MODE', 'selfhost');
    expect(deploymentMode()).toBe('selfhost');
  });

  it('refuses a value it doesn\'t know, rather than guessing', () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'hosted');
    expect(() => deploymentMode()).toThrow('DEPLOYMENT_MODE "hosted" isn\'t one of: selfhost, cloud.');
  });
});

describe('GET /api/meta', () => {
  it('says what the server is and offers, with no sign-in', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    vi.stubEnv('AI_MODEL', 'google:gemini-flash-lite-latest');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-key');
    vi.stubEnv('MQTT_URL', '');

    const response = await meta();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: 'Concerning Habits',
      version,
      apiVersion: 1,
      mode: 'cloud',
      signIn: ['google'],
      features: { ai: true, mqtt: false },
    });
  });

  it('follows the settings it\'s given', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '');
    vi.stubEnv('AI_MODEL', 'google:gemini-flash-lite-latest');
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    vi.stubEnv('MQTT_URL', 'mqtt://homeassistant.local:1883');

    const body = await (await meta()).json();
    expect(body.mode).toBe('selfhost');
    expect(body.features).toEqual({ ai: false, mqtt: true });
  });
});
