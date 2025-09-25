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

- Verify solutions with tests when available
- Check README or search codebase to determine testing approach
- Never assume specific test frameworks without verification

## Git Workflow

- Only commit changes when explicitly requested
- Follow existing commit message conventions
- Create descriptive commit messages focusing on the "why" rather than "what"

## File Management

- Prefer editing existing files over creating new ones
- Follow established project structure and naming conventions
- Use absolute paths when working with files