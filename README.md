# AI Context Bridge (LinkedIn)

Chrome Extension (MV3) + external React app to assist with LinkedIn comments.

## Important behavior (manual flow)

Because the AI API is paid, this project does **not** auto-inject or auto-generate comments continuously.

Manual flow:

1. Click the desired LinkedIn comment input field.
2. Click **Generate** in the side panel.
3. The app returns a standard generated comment (same generation behavior for comment fields).
4. Click **Insert** to inject that generated text into the currently selected comment field.

## Project structure

- `web/`: Vite + React + Tailwind UI used inside the side panel iframe
- `web/api/generate.ts`: serverless endpoint (`/api/generate`) for OpenRouter
- `extension/`: MV3 extension (`manifest`, `background`, `contentScript`, side panel host)

## Local development

### 1) Web app

```bash
cd web
npm install
npm run dev
```

### 2) Load extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

### 3) Side panel app URL

In the side panel header, set the app URL and click **Save**.

## Vercel deployment

This project is configured with `Root Directory = web`.

Required environment variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional, default: `openai/gpt-4o-mini`)

After deploy, verify:

- `GET /api/generate` returns `{"error":"Method not allowed"}` (expected)
- `POST /api/generate` returns generated text

## Security note

Never commit API keys to the repository.  
If a key was exposed, revoke it and create a new one immediately.