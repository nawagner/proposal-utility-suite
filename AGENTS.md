# Agent Playbook

- Use `npm run lint` to validate the repo before wrapping up a change set.
- `npm run dev` streams logs to `dev.log`; tail that file to inspect runtime issues.
- Exercise new rubric intake and synthetic proposal flows locally before shipping updates.
- Keep `.env.local` in sync with required API keys (e.g., OpenRouter) when touching LLM integrations.
- Structured rubrics now live under `/rubrics` and persist in DuckDB (`DUCKDB_PATH`, defaults to `storage/rubrics.duckdb`); run `npm run test:unit` after changes to the persistence layer.
