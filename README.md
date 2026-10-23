# NekoMemo

Study topics + flashcards, with AI-generated cards via Google Gemini. Static site + one Vercel serverless function.

## Structure
- `index.html` – the whole front end (data saved in the browser's localStorage)
- `api/generate-cards.js` – Vercel function that calls Gemini (the key never reaches the browser)
- `manifest.webmanifest`, `sw.js`, `icons/` – installable PWA
- `vercel.json`, `package.json` – Vercel config

## Deploy on Vercel
1. Put this folder in a GitHub repo (or run `npx vercel` in the folder).
2. In Vercel: Add New → Project → import the repo. Framework preset: **Other**. No build command, no output directory.
3. Project → Settings → Environment Variables: add `GEMINI_API_KEY` (get a free key at https://aistudio.google.com/apikey). Optional: `GEMINI_MODEL`.
4. Redeploy so the variable takes effect.

## Run locally
`npx vercel dev` (runs the page and the `/api` function together). Put the key in a `.env.local` file: `GEMINI_API_KEY=...`. Never commit it.

## Notes
- Data lives only in the current browser; clearing site data deletes it.
- If the key is missing or the free quota runs out, the app shows a message and everything else keeps working.
