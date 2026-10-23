# NekoMemo website

A responsive, static website starter for NekoMemo. It can be hosted on Netlify or another static host.

## Features included
- Dashboard and subject picker
- Create and save learning topics
- Structured starter lesson pages
- Create, edit, star, delete, search, and filter personal flashcards
- Flashcard practice with Again / Difficult / Good / Easy review intervals
- Due revision list
- Starter quizzes and saved quiz history
- JSON backup export/import
- Browser localStorage persistence
- Responsive mobile layout and basic PWA/offline caching

## Important AI limitation
This version does **not** call an AI model. It uses starter lesson templates and general study-strategy quiz questions. It is usable without an API key, but it does not yet dynamically generate verified subject-specific explanations. To add real AI generation, connect a server-side/serverless endpoint (for example, a Netlify Function) to an AI provider. Never place an API secret in `index.html` or frontend JavaScript.

## Run locally
The easiest way is to serve the folder over HTTP:
- With Python installed, open a terminal in this folder and run `python -m http.server 8000`
- Visit `http://localhost:8000`

Opening `index.html` directly also works for most features, but PWA service-worker features require HTTP/HTTPS.

## Publish on Netlify
1. Unzip the downloaded project.
2. For this static version, you can drag the folder containing `index.html` to Netlify Drop, or deploy the folder through a Git repository.
3. The site is static, so no build command is needed.
4. If you later add a backend or AI function, deploy that through Netlify's supported project workflow and set API keys in environment variables.

## Data and privacy
Data is saved in the current browser on the current device. It does not sync across devices and can be lost if browser site data is cleared. Use My Library → Export backup regularly. Do not use this prototype to store sensitive information.
