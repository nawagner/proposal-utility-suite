# Claude Development Guidelines

This file contains important development guidelines and conventions for this project.

## Development Server Guidelines

- **Always pipe dev server output to dev.log**: When running development servers, redirect output to `dev.log` for better log management and debugging
  ```bash
  npm run dev > dev.log 2>&1 &
  ```

## Code Quality

- Run linting and type checking before committing changes
- Follow existing code conventions and patterns
- Never commit secrets or sensitive data

## Testing

- Run tests with `npm test` (Playwright)
- Interactive test UI available via `npm run test:ui`
- Run rubric persistence unit tests with `npm run test:unit`
- Verify test coverage before committing significant features
- Check README or search codebase to determine testing approach

## Git Workflow

- Only commit changes when explicitly requested
- Follow existing commit message conventions
- Create descriptive commit messages focusing on the "why" rather than "what"

## File Management

- Prefer editing existing files over creating new ones
- Follow established project structure and naming conventions
- Use absolute paths when working with files

## localStorage & Client State

- Structured rubrics are stored in DuckDB; localStorage keeps only the selected rubric id (`proposal-suite-rubric-selection-v1`) and review state (`proposal-suite-review-v1`)
- Legacy rubric text may still appear in localStorage under `proposal-suite-rubric-v1` for migration, but new flows rely on the DuckDB-backed API
- When debugging storage issues, clear localStorage keys manually or add version bumps to storage key constants in `src/lib/storage-keys.ts`
- Always test localStorage flows in the browser before deploying
