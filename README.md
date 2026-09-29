# Concerning Habits

Concerning Habits is an AI-powered, highly customizable habit tracking progressive web app (PWA) built with Next.js, Prisma, and Tailwind.

## Prerequisites

- Node.js (v20.9+)
- npm
- A Google Gemini API key (for AI multimodal and schema features)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env` file in the root of the project and add your Google Gemini API key:
   ```env
   DATABASE_URL="file:./dev.db"
   GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
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

## Database Management

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
      # Add your Gemini API key for AI features
      - GOOGLE_GENERATIVE_AI_API_KEY=your-google-gemini-api-key
      
      # Optional: Home Assistant (MQTT) Integration
      - MQTT_URL=mqtt://homeassistant.local:1883
      # - MQTT_USERNAME=your-username
      # - MQTT_PASSWORD=your-password
      # - MQTT_TOPIC_PREFIX=concerninghabits
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

### Running the App

1. Ensure you have Docker and Docker Compose installed.
2. Provide your `GOOGLE_GENERATIVE_AI_API_KEY` in the `docker-compose.yml`.
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
