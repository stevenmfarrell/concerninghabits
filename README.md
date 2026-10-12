# Concerning Habits

Concerning Habits is an AI-powered, highly customizable habit tracking progressive web app (PWA) built with Next.js, Prisma, and Tailwind.

## Prerequisites

- Node.js (v20.9+)
- npm
- An AI model for the AI features: a Google Gemini API key by default, or another provider or a local model (see [Choosing an AI Model](#choosing-an-ai-model))

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env` file in the root of the project and add your Google Gemini API key (or [another model](#choosing-an-ai-model)), plus, optionally, a TypeSafe API key for the dashboard's "I did..." voice capture (it matches what you said to one of your habits; without one, [the AI model or a simpler match is used](#matching-what-you-say-to-a-habit)):
   ```env
   DATABASE_URL="file:./dev.db"
   GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
   TYPESAFE_API_KEY="your-typesafe-api-key"
   ```

3. **Initialize the Database:**
   Apply the committed Prisma migrations to create the necessary tables:
   ```bash
   npx prisma migrate deploy
   ```

4. **Run the Development Server:**
   Start the Next.js frontend and API routes:
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Choosing an AI Model

Designing a habit's form, filling in entries from what you say, type or photograph, and suggesting charts and formulas all use one model, set with `AI_MODEL` as `<provider>:<model>`. It defaults to `google:gemini-flash-lite-latest`.

| Provider | Example `AI_MODEL` | Also set |
| --- | --- | --- |
| Google Gemini | `google:gemini-flash-lite-latest` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Anthropic | `anthropic:claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai:gpt-5-mini` | `OPENAI_API_KEY` |
| Local / OpenAI-compatible | `local:qwen3:8b` | `AI_BASE_URL`, and `AI_API_KEY` if the server needs one |

`local` works with any server that speaks the OpenAI chat API: Ollama (`AI_BASE_URL=http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`), llama.cpp's server, vLLM, LiteLLM or OpenRouter. From inside Docker, reach a server on the host at `host.docker.internal` rather than `localhost`. A few things to know about local models:

- Every request asks for a JSON answer matching a schema. Small models get this wrong more often, designing a habit's form most of all, so prefer a model of around 8B parameters or more.
- Logging from a photo needs a model that accepts images.
- A thinking model (e.g. Qwen 3.5) thinks before every answer, which on a laptop can take 20 seconds or more. Set `AI_REASONING_EFFORT=none` to turn that off (see below). With Qwen 3.5 4B it took a request from about 20 seconds to about 1, with the same answers.
- Matching what you say to a habit can use this model too (see below).

`AI_REASONING_EFFORT` sets how much a thinking model thinks before answering, with any provider: `none`, `minimal`, `low`, `medium`, `high` or `xhigh` (or `provider-default`, the same as leaving it unset). Each provider maps it to its own setting: `reasoning_effort` for OpenAI and local servers, a thinking budget for Gemini, extended thinking for Claude. The app's requests are short form fills and lookups, so `none` is usually the right choice.

### Matching What You Say to a Habit

The Agenda's "I did..." button, `POST /api/log`, and "I did..." text queued while offline first work out which of your habits you meant. `HABIT_MATCHER` chooses how:

| `HABIT_MATCHER` | How | Needs |
| --- | --- | --- |
| `jev` | TypeSafe's Jev. The most accurate, with calibrated confidence. | `TYPESAFE_API_KEY` |
| `llm` | The model set by `AI_MODEL`. More likely to ask which habit you meant. | A working `AI_MODEL` |
| `none` | No AI: "I did..." always asks, listing the habits that share words with what you said. `/api/log` and queued text without a habit log nothing, so log to a habit directly. | Nothing |

Left unset, it's `jev` if `TYPESAFE_API_KEY` is set, otherwise `llm` if the AI model is set up, otherwise `none`. However they're matched, `/api/log` and queued text only log to a habit the matcher is sure of.


To easily view, edit, and manage the underlying database records (Habits, Logs, Users, Categories), you can use Prisma Studio:

```bash
npx prisma studio
```
This will open a database management UI at [http://localhost:5555](http://localhost:5555).

## Testing on Mobile (PWA)

Concerning Habits is configured as a Progressive Web App (PWA). To install it on your phone's home screen during development, you must access it over a secure HTTPS connection (a strict requirement for PWAs). 

The easiest way to do this without setting up a reverse proxy or dealing with browser security flags is to use `localtunnel`:

1. Start your local dev server (`npm run dev`).
2. In a new terminal window, run:
   ```bash
   npx localtunnel --port 3000
   ```
3. Open the generated `https://` link on your phone.
4. Use your browser's menu to select **"Install app"** or **"Add to Home Screen"**.

## Self-Hosting with Docker

You can easily host Concerning Habits yourself using Docker and Docker Compose. 

Create a `docker-compose.yml` file with the following contents:

```yaml
version: '3.8'

services:
  concerning-habits:
    build: .
    # Or use a pre-built image if you publish one:
    # image: your-registry/concerning-habits:latest
    container_name: concerning-habits
    ports:
      - "3000:3000"
    environment:
      # Add your Gemini API key for AI features, or choose another model (see "Choosing an AI Model")
      - GOOGLE_GENERATIVE_AI_API_KEY=your-google-gemini-api-key
      # - AI_MODEL=local:qwen3:8b
      # - AI_BASE_URL=http://host.docker.internal:11434/v1
      # Optional: a TypeSafe API key for matching "I did..." to a habit (see "Matching What You Say to a Habit")
      - TYPESAFE_API_KEY=your-typesafe-api-key
      
      # Optional: Home Assistant (MQTT) Integration
      - MQTT_URL=mqtt://homeassistant.local:1883
      # - MQTT_USERNAME=your-username
      # - MQTT_PASSWORD=your-password
      # - MQTT_TOPIC_PREFIX=concerninghabits

      # Optional: reminders (Web Push). Keys are generated and stored in the database on first use;
      # set these only to supply your own. The subject defaults to the first admin's email.
      # - VAPID_PUBLIC_KEY=...
      # - VAPID_PRIVATE_KEY=...
      # - VAPID_SUBJECT=mailto:you@example.com
    volumes:
      - concerning-habits_data:/app/data
    restart: unless-stopped

    # Hardening: the image already runs as an unprivileged user (uid 1001) that can only write to
    # /app/data. These additionally drop every Linux capability, block privilege escalation, and
    # make the rest of the filesystem read-only (Next.js only needs a writable /tmp and cache).
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache:uid=1001,gid=1001

volumes:
  concerning-habits_data:
```

### Reminders

Habit reminders are Web Push notifications, turned on per device under Settings → Reminders and per habit on its page. Browsers only allow push over **https** (or `localhost`), so serve the app behind a reverse proxy with TLS to use them. On iPhone and iPad, the app must be added to the Home Screen first.

### Offline

Installed as an app, Concerning Habits keeps working without a connection (in a production build; `npm run dev` caches nothing):

- **Opening it:** the service worker (`public/sw.js`) keeps a copy of each page you visit, plus the tabs and the habit and category pages they link to. Online, pages always come from the server; the copies are only used when it can't be reached. A page never opened on the device shows a short offline notice instead.
- **Making changes:** logging, editing or deleting an entry, and skipping, keep working. If the server can't be reached, the change is kept on the device (in IndexedDB) and sent to `/api/sync` once it can, with the time it was actually made. A pill above the bottom nav says how many are waiting. Anything said or typed for AI to fill in (voice, or the Agenda's "I did…") is kept as text and filled in once it's sent. Logging from a photo needs a connection.
- **When a change can't be made** (say the habit was deleted meanwhile, or its form now needs a value the entry doesn't have), it's kept as "Couldn't sync". From there you can finish it by hand, try again, or discard it. Nothing is dropped silently.

Copies of pages are cleared on signing out. Changes waiting on a shared device are only ever sent for the person who made them.

### Logging from Other Apps (API)

Other apps (iOS Shortcuts, Home Assistant, Tasker, an NFC tag) can log and read entries with an API key, made under Settings → API Keys. A key acts as its user and is allowed to log, read, or both (chosen when it's made, and changeable later). It can't change or delete anything. Send it as `Authorization: Bearer ch_...` or `X-API-Key: ch_...`, or for an app that can't set headers, as `?key=ch_...` in the URL. Settings → API Keys documents each route with examples.

- `POST /api/habits/<habit id>/log` (a key that can log) logs one habit. The body is optional JSON: `{"values": {"distance": 3}}` with the habit's field keys, and/or `{"text": "ran 3 miles"}` for AI to fill them in, plus an optional `"at"` (an ISO 8601 date and time) for an earlier entry. Each habit's address, field keys and an example request are in its ⋮ menu → Log from Another App.
- `GET /api/habits/<habit id>/entries?limit=10` (a key that can read) returns the habit's latest entries, newest first (1 to 100, 10 by default), each with who logged it.
- `POST /api/log` (a key that can log) with `{"text": "ran 3 miles in 25 minutes"}` works out which habit was meant, like the Agenda's "I did..." button. It never creates a habit, and logs nothing (answering 422 with its best guesses) when it isn't sure.

Both answer `201` with the new entry. A key can make 600 requests an hour, and requests with `text` count toward the user's AI limit.

### Running the App

1. Ensure you have Docker and Docker Compose installed.
2. Provide your `GOOGLE_GENERATIVE_AI_API_KEY` (or [another model's settings](#choosing-an-ai-model)) and, optionally, `TYPESAFE_API_KEY` in the `docker-compose.yml`.
3. Start the container in detached mode:
   ```bash
   docker compose up -d
   ```
4. Access the app at `http://localhost:3000`.
5. The container applies committed migrations (`prisma migrate deploy`) on startup and persists your data in the `concerning-habits_data` volume. Unlike pushing the schema directly, a migration can't silently drop a column's data.

**Upgrading from a version that used `prisma db push`:** your existing database already has the current tables, but no migration history, so `migrate deploy` will refuse to run against it. Baseline it once before pulling the new image:
```bash
docker compose run --rm concerning-habits npx prisma migrate resolve --applied 20260928000839_init
```
