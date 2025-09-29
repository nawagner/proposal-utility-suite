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

- `npm run dev` – start the local development server on `http://localhost:3000` (uses Turbopack)
- `npm run lint` – run ESLint with the Next.js config
- `npm run build` – create an optimized production build (uses Turbopack)
- `npm run start` – serve the production build
- `npm test` – run Playwright tests
- `npm run test:ui` – run Playwright tests with interactive UI

## OpenRouter Integration

- Outbound requests are implemented in `src/lib/openrouter.ts`. The helper signs requests with `OPENROUTER_API_KEY`, applies sane defaults, and throws readable errors when configuration is missing.
- The `/api/chat` route in `src/app/api/chat/route.ts` proxies chat completions through your backend so secrets stay server-side.
- The homepage UI at `src/app/page.tsx` renders `ChatPlayground` (`src/components/chat-playground.tsx`), a lightweight form that demonstrates calling the API route.

## Proposal Uploads

- Use the upload panel on the homepage to select a call-for-proposals document in PDF, Word (`.docx`), or plain-text format.
- The request is handled by `src/app/api/upload/route.ts`, which parses files up to 5MB via the helpers in `src/lib/file-parser.ts`.
- Successful uploads return filename metadata, a word/character count, and a text preview so you can confirm the content before sending it to OpenRouter.

## Proposal Review System

The application includes an AI-powered proposal review system:

- **Rubric Management**: Upload or manually paste evaluation rubrics (PDF, DOCX, or TXT) via the `RubricIntake` component. Rubrics are persisted in localStorage.
- **Batch Review**: Upload up to 12 proposals at once (PDF, DOCX, or ZIP archives) for evaluation against your rubric.
- **Structured Output**: Reviews use OpenRouter's structured output feature with JSON schema validation and `jsonrepair` fallback for robustness.
- **Review API**: The `/api/review` endpoint processes proposals and returns pass/fail verdicts, criterion-by-criterion analysis, strengths, and improvement recommendations.
- **Review Persistence**: Review results are stored in localStorage for session persistence.

Review configuration:
- Default model: `openai/gpt-5` (configurable via `OPENROUTER_REVIEW_MODEL` or `OPENROUTER_DEFAULT_MODEL`)
- Maximum proposals per batch: 12
- Maximum proposal text length: 12,000 characters per document

## Deploying on Vercel

1. Push this repository to GitHub (or your preferred git host) and import it into Vercel.
2. In the Vercel dashboard, add the following Environment Variables:
   - `OPENROUTER_API_KEY`
   - (optional) `OPENROUTER_DEFAULT_MODEL`
   - (optional) `OPENROUTER_REVIEW_MODEL` – specify a different model for proposal reviews (defaults to `openai/gpt-5`)
   - (optional) `OPENROUTER_BASE_URL`
   - (optional) `NEXT_PUBLIC_APP_URL` – set to `https://your-project.vercel.app`
3. Trigger a deployment. Vercel will run `npm install`, `npm run build`, and serve the production output automatically.

## Project Structure Highlights

- `src/app/page.tsx` – landing page with rubric intake and proposal reviewer
- `src/app/api/chat/route.ts` – serverless function proxying chat completions
- `src/app/api/upload/route.ts` – multipart endpoint parsing proposal documents
- `src/app/api/review/route.ts` – batch proposal review endpoint with structured JSON output
- `src/app/api/synthetic/route.ts` – synthetic proposal generation endpoint
- `src/components/rubric-intake.tsx` – client component for rubric upload and management
- `src/components/proposal-reviewer.tsx` – client component for batch proposal analysis
- `src/components/synthetic-proposal-generator.tsx` – client component for generating test proposals
- `src/components/chat-playground.tsx` – client component powering the OpenRouter chat demo
- `src/components/proposal-upload.tsx` – client component for ingesting proposal documents
- `src/lib/openrouter.ts` – reusable OpenRouter client helper with structured output support
- `src/lib/file-parser.ts` – shared utilities to extract text from PDFs, DOCX, and TXT files
- `src/lib/storage-keys.ts` – TypeScript interfaces and localStorage keys for client-side persistence
- `docs/` – legacy project documents migrated from the original repository root

## Dependencies

Key dependencies added beyond base Next.js:
- `jszip` – ZIP archive processing for batch proposal uploads
- `jsonrepair` – Robust JSON parsing with automatic repair for malformed LLM outputs
- `mammoth` – DOCX to text conversion
- `pdf-parse` – PDF text extraction
- `@playwright/test` – End-to-end testing framework

## Additional Notes

- Keep your `.env.local` file out of version control; Vercel respects the same variable names you configure locally.
- Refer to `docs/README.md` for any prior documentation that shipped with this repository.
