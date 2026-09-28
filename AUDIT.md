# Concerning Habits audit

_2026-09-27, at commit `7f5e013`_

The core idea works well: describe a habit in plain English, the app builds the logging form, and you can log by voice or photo. The biggest problems are security holes in the server actions, which matter now that the app supports multiple users, and a Docker startup step that can wipe data.

## What it does well

### Usability
- **AI habit creation.** "Track my morning run" becomes a small form with units, a duration widget and a suggested frequency. It respects the user's emoji and unit settings, and for simple habits it adds no fields, so a log is just one tap.
- **Fast logging.** Voice and photo logging fill in the form, and once all required fields are filled it saves automatically, with a 6-second undo. Manual logs also get an undo toast. Backdating works, and the form can be prefilled from URL parameters, so shortcuts and automations can log habits.
- **"Bedtime" setting.** A late-night log counts toward the day you're still living in, not the next calendar day. Most habit trackers get this wrong.
- **Good onboarding.** There's a first-run admin setup, starter categories, a friendly empty state, and new accounts are forced to change their password.
- **Mobile-first layout.** Bottom nav, large tap targets, activity heatmaps you can read at a glance, and drag-to-reorder.
- **Self-hosting.** Docker, SQLite on a volume, and optional publishing of logs to Home Assistant over MQTT.

### Code
- Small and easy to follow: about 5k lines of app code. Data access lives in `actions/db.ts`, and pages are mostly server components.
- Most actions that change data check that the record belongs to the current user. The pattern is right; it just isn't applied everywhere (see below).
- Authentication is reasonable for a self-hosted app: bcrypt passwords, httpOnly session cookies stored in the database, and a login rate limit.
- AI output is forced into a structured shape with zod (`generateObject`), not parsed from free text.

## Problems, most severe first

### Security (fix these first)
1. **Any user can make themselves admin.--FIXED** `updateUserPreferences` (`src/app/actions/db.ts:258`) passes `prefs` straight into `prisma.user.update`. TypeScript types aren't checked at runtime, so a logged-in user can call the action with `{ isAdmin: true }` or a new `passwordHash`. Fix: parse `prefs` with a zod schema that only allows the preference fields.
2. **Password hashes are sent to the browser.--FIXED** `getDefaultUser()` returns the full user record, and it's passed as `user={user}` to client components (`LogClient`, `SortableLists`). That puts `passwordHash` in the page payload. Use a `select` that returns only safe fields.
3. **The AI actions don't check who's calling.--FIXED** `parseVoiceLog` and `parseImageLog` never call `getDefaultUser()`. The middleware only checks that a `session` cookie exists, not that it's valid, so anyone with a made-up cookie can use your Gemini quota.
4. **Category and parent IDs aren't checked.--FIXED** `createCategory`, `updateCategory`, `saveHabit` and `updateHabit` accept a `parentId` or `categoryId` without checking the user owns it. `updateCategory` also doesn't stop a category from becoming its own parent through a loop.
5. **Anyone can lock you out.--FIXED** The login rate limit is keyed only on email, and successful logins also count toward the limit. Five bad attempts from anyone lock that account for 15 minutes, and even five normal logins do the same.
6. **Smaller gaps:--FIXED** no minimum password length, changing your password doesn't sign out other sessions, and sessions last 365 days.

### Data safety
7. **Every container start can drop data.** The Dockerfile runs `prisma db push --accept-data-loss` at startup. If you rename or remove a schema field, the next deploy silently deletes that column's data. It also installs the Prisma CLI with `npm install -g prisma` without a version, so it can pull Prisma 7 while the app uses 6.19. Switch to `prisma migrate deploy` with committed migrations, and pin the version.
8. **Logged data isn't checked on the server.** `logHabitEvent` stores whatever `payload` it receives. The form is only validated in the browser.

### Usability
9. **Reordering doesn't show up on the home screen.--FIXED** You've put real work into drag-to-reorder, but the dashboard (`src/app/page.tsx`) sorts categories alphabetically and habits by newest first. It also flattens subcategories into their own top-level groups.
10. **Two "Other" sections can appear.--FIXED** Uncategorized habits are labeled "Other", and "Other" is also a default category, so you can get two "Other" groups. Groups also use `name` as their React key, which collides for duplicate names.
11. **The AI only knows the default categories.--FIXED** Its category list is hard-coded to Mind, Body, Chores and Other. If a user renames or deletes those, or adds their own, suggestions won't match.
12. **Time zones.--FIXED** Server components work out dates in the server's time zone, which is UTC in Docker. That includes the date header, the `getHabits` date window, and the first server render of `ActivityCalendar`. Near midnight, days can land in the wrong bucket, and the server and browser renders may disagree.
13. **Accessibility.** There is one `aria-label` in the whole codebase. Icon-only buttons (the mobile add button, menus, chevrons) have at most a `title` attribute.
14. **Offline logging doesn't work.** The README calls it a PWA, but `SWUnregister` removes every service worker, so nothing works without a connection.

### Code quality
15. **Loads more data than it needs.** `getCategory` and `getCategoriesWithHierarchy` load every log ever recorded, including full payloads, just to draw a 5-week calendar. This will slow down as history grows.
16. **Weak typing and lint debt.** There are 67 uses of `any`, mostly on `habit`, `user` and `payload`, which hides mistakes like #2. ESLint reported 14 errors in `ActivityCalendar.tsx` and `SortableLists.tsx` alone; the rest of `src` wasn't counted.
17. **Duplicated code.** Default-category seeding is copied between `setupInitialAdmin` and `provisionUser`. The default target count of `3` is hard-coded in several places.
18. **Outdated Next.js convention.** Next 16 deprecates `middleware.ts` in favor of `proxy.ts`. The middleware also skips every path containing a `.`, which is a broad exemption.
19. **No tests.** The first things worth testing are the day-bucketing logic (bedtime, week start, time zones) and the checks that users can only touch their own data.
20. **Repo clutter.** One-off Python patch scripts (`add_chevrons.py`, `align_calendar.py`, …) and `prisma/schema.prisma.bak` are committed. The package is named `concerning-habits`, which doesn't match `habiton`. Editing through these scripts is also fragile: `fix_calendar_color.py` quietly did nothing when its search text didn't match, which is why the calendar fix was left half-done.

## Suggested order
1. Fix #1–3 (about an hour).
2. Fix #7 before the next schema change.
3. Fix #9, the most visible usability gap.
4. Add zod validation to all server actions, which covers #4 and #8.
