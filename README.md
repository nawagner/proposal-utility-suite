# Proposal Utility Suite

A Next.js 15 application that connects to OpenRouter so you can prototype AI-assisted proposal tooling and deploy it seamlessly on Vercel.

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)
- npm 9+

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your OpenRouter API key. Optional values such as `OPENROUTER_DEFAULT_MODEL` and `OPENROUTER_BASE_URL` let you pin a model or route calls through a proxy.
3. (Optional) Set `NEXT_PUBLIC_APP_URL` in `.env.local` so OpenRouter receives an accurate `HTTP-Referer` header.

## Available Scripts

- `npm run dev` – start the local development server on `http://localhost:3000`
- `npm run lint` – run ESLint with the Next.js config
- `npm run build` – create an optimized production build
- `npm run start` – serve the production build

## OpenRouter Integration

- Outbound requests are implemented in `src/lib/openrouter.ts`. The helper signs requests with `OPENROUTER_API_KEY`, applies sane defaults, and throws readable errors when configuration is missing.
- The `/api/chat` route in `src/app/api/chat/route.ts` proxies chat completions through your backend so secrets stay server-side.
- The homepage UI at `src/app/page.tsx` renders `ChatPlayground` (`src/components/chat-playground.tsx`), a lightweight form that demonstrates calling the API route.

## Proposal Uploads

- Use the upload panel on the homepage to select a call-for-proposals document in PDF, Word (`.docx`), or plain-text format.
- The request is handled by `src/app/api/upload/route.ts`, which parses files up to 5MB via the helpers in `src/lib/file-parser.ts`.
- Successful uploads return filename metadata, a word/character count, and a text preview so you can confirm the content before sending it to OpenRouter.

## Deploying on Vercel

1. Push this repository to GitHub (or your preferred git host) and import it into Vercel.
2. In the Vercel dashboard, add the following Environment Variables:
   - `OPENROUTER_API_KEY`
   - (optional) `OPENROUTER_DEFAULT_MODEL`
   - (optional) `OPENROUTER_BASE_URL`
   - (optional) `NEXT_PUBLIC_APP_URL` – set to `https://your-project.vercel.app`
3. Trigger a deployment. Vercel will run `npm install`, `npm run build`, and serve the production output automatically.

## Project Structure Highlights

- `src/app/page.tsx` – landing page that pairs the upload experience with the chat demo
- `src/app/api/chat/route.ts` – serverless function proxying chat completions
- `src/app/api/upload/route.ts` – multipart endpoint that parses proposal documents
- `src/components/chat-playground.tsx` – client component powering the OpenRouter chat demo
- `src/components/proposal-upload.tsx` – client component for ingesting proposal documents
- `src/lib/openrouter.ts` – reusable OpenRouter client helper
- `src/lib/file-parser.ts` – shared utilities to extract text from PDFs, DOCX, and TXT files
- `docs/` – legacy project documents migrated from the original repository root

## Additional Notes

- Keep your `.env.local` file out of version control; Vercel respects the same variable names you configure locally.
- Refer to `docs/README.md` for any prior documentation that shipped with this repository.
