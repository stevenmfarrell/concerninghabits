# Habiton

Habiton is an AI-powered, highly customizable habit tracking progressive web app (PWA) built with Next.js, Prisma, and Tailwind.

## Prerequisites

- Node.js (v18+)
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
   Push the Prisma schema to the local SQLite database to create the necessary tables:
   ```bash
   npx prisma db push
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

Habiton is configured as a Progressive Web App (PWA). To install it on your phone's home screen during development, you must access it over a secure HTTPS connection (a strict requirement for PWAs). 

The easiest way to do this without setting up a reverse proxy or dealing with browser security flags is to use `localtunnel`:

1. Start your local dev server (`npm run dev`).
2. In a new terminal window, run:
   ```bash
   npx localtunnel --port 3000
   ```
3. Open the generated `https://` link on your phone.
4. Use your browser's menu to select **"Install app"** or **"Add to Home Screen"**.
