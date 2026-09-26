import mqtt from 'mqtt';

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'habiton';

// Global variable to maintain the connection in a serverless/Next.js dev environment
const globalForMqtt = global as unknown as { mqttClient: mqtt.MqttClient | null };

let client = globalForMqtt.mqttClient || null;

export function getMqttClient() {
  if (client) return client;
  if (!MQTT_URL) return null;

  try {
    client = mqtt.connect(MQTT_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      reconnectPeriod: 5000,
    });

    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForMqtt.mqttClient = client;
    }

    return client;
  } catch (e) {
    console.error('Failed to initialize MQTT', e);
    return null;
  }
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Remove non-word characters (emojis, punctuation)
    .replace(/[^\w\s-]/g, '')
    // Replace spaces and hyphens with underscores
    .replace(/[\s-]+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '');
}

export function publishHabitLog(user: any, habit: any, payload: any) {
  const mqttClient = getMqttClient();
  if (!mqttClient) return;

  const userSlug = slugify(user.name);
  const habitSlug = slugify(habit.name);
  // e.g. habiton/users/steven/habits/morning_run/log
  const topic = `${MQTT_TOPIC_PREFIX}/users/${userSlug}/habits/${habitSlug}/log`;
  
  const message = JSON.stringify({
    userId: user.id,
    userName: user.name,
    habitId: habit.id,
    habitName: habit.name,
    payload: payload,
    timestamp: new Date().toISOString(),
  });

  mqttClient.publish(topic, message, { qos: 0 }, (err) => {
    if (err) {
      console.error('Failed to publish MQTT message:', err);
    }
  });
}
