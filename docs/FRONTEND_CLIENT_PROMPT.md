# Frontend Client Prompt – AI Assistant Sign-Up & Setup

Use this prompt to brief a frontend developer or AI to build (or improve) the sign-up/setup web client for the AI Assistant Telegram bot.

---

## Prompt (copy-paste)

**Context:** We have a Telegram AI assistant. When users send `/start`, the bot sends a “Set up my account” button that opens a **Telegram Web App** (mini app inside Telegram). The web app is a sign-up/setup flow where users configure their account (timezone, location, personalizations, etc.) before using the bot.

**Your task:** Build a **frontend client** (single-page app or multi-step flow) that:

1. **Runs as a Telegram Web App**
   - Is opened from Telegram via a button (URL is `{API_BASE_URL}/app`).
   - Uses the [Telegram Web App API](https://core.telegram.org/bots/webapps): include `https://telegram.org/js/telegram-web-app.js` and use `window.Telegram.WebApp`.
   - On load, read `window.Telegram.WebApp.initData` (string). This is the **only** way to authenticate: send it to the backend on every API call; the backend validates it and knows the Telegram user. Do not use passwords or separate login.

2. **Backend API (same origin as the app)**
   - **POST /webapp/init**  
     Body: `{ "initData": "<Telegram initData string>" }`  
     Returns: `{ user: { userId, timezone, hasTodoist } }` or `{ error: "..." }`.  
     Call this on app load to get the current user (and create one if first time).

   - **PATCH /webapp/me**  
     Body: `{ "initData": "<string>", "timezone": "America/New_York" }` (other fields may be added later).  
     Returns: `{ user: { userId, timezone } }` or `{ error: "..." }`.  
     Use this to save timezone and other profile/settings.

   - All requests: `Content-Type: application/json`. No auth header; auth is via `initData` in the body.

3. **Required flows and UI**
   - **First-time setup (sign-up feel):**
     - If `/webapp/init` returns a user with default timezone (e.g. UTC), show a short “Set up your account” flow.
     - **Timezone:** Let the user choose timezone (dropdown or search) and/or “Detect my timezone” using `Intl.DateTimeFormat().resolvedOptions().timeZone`. If the detected value is not in the list, still allow saving it (e.g. add as option or send as custom string).
     - **Location (optional):** “Use my location” that calls `navigator.geolocation`; send lat/lng to backend if we add a **POST /location** (or include in PATCH /webapp/me) so the backend can set timezone from coordinates. If the backend doesn’t support it yet, just store or show lat/lng for future use.
     - After saving, show success and optionally call `Telegram.WebApp.close()` to close the mini app.

   - **Returning user:**
     - If the user already has a timezone set, show a simple “Your settings” view: display timezone (and any other saved data) and allow editing (same form or modal). Save via PATCH /webapp/me.

   - **Not opened from Telegram:**
     - If `!window.Telegram?.WebApp?.initData`, show a single message: “Open this link from the Telegram app to set up your account.” No forms, no API calls.

4. **Design and UX**
   - Mobile-first (most users open from Telegram on phone).
   - Use Telegram’s theme variables so it feels native: `var(--tg-theme-bg-color)`, `var(--tg-theme-text-color)`, `var(--tg-theme-button-color)`, `var(--tg-theme-hint-color)`, etc. Provide sensible fallbacks (e.g. dark background, light text).
   - Prefer a single-page flow: one screen for “Set up” (timezone + optional location), one for “Settings” (view/edit). No separate “login” page; auth is initData.
   - Accessible: labels, focus states, clear errors (show backend `error` message if any).

5. **Tech**
   - Vanilla HTML/CSS/JS is fine. If you use a framework (React, Vue, Svelte), keep the bundle small and ensure it works when served as static files from the same origin as the API (e.g. `GET /app` serves `index.html`).
   - Do not add a separate backend or auth layer; the existing backend validates `initData` and manages user by Telegram user id.

6. **Optional (future)**
   - Todoist connect: field to paste Todoist API token and save (if backend adds PATCH /webapp/me with `todoistToken`).
   - Display name / preferences: any extra fields the backend adds later; same pattern: show in “Settings”, send in PATCH /webapp/me with `initData`.

**Deliverables:**  
- Static files (e.g. `index.html` + assets) that can be served at `{API_BASE_URL}/app` (or a subpath the backend is configured for).  
- Clear readme or comments on how to run locally (same origin as API) and how auth works (initData only).

---

## What we built so far (for reference)

- **Backend:**  
  - `POST /webapp/init` and `PATCH /webapp/me` (timezone only for now).  
  - `GET /app` serves a minimal setup page (`webapp/index.html`).  
  - Telegram initData is validated in `src/telegram-webapp.ts` (HMAC-SHA256 with bot token).

- **Bot:**  
  - On `/start`, sends a welcome message and an inline button “Set up my account” that opens the Web App URL (`API_BASE_URL/app`).

- **Current webapp:**  
  - Single HTML file: if no initData, shows “Open from Telegram”; otherwise loads user with `/webapp/init`, form with timezone dropdown + “Detect my timezone”, submit via PATCH `/webapp/me`, then success and optional close.

Use the prompt above to replace or extend this with a proper frontend client (better UX, optional location, future Todoist/preferences, etc.).
