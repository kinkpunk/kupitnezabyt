# AGENTS.md

## Project

kupitnezabyt is a Telegram Mini App / WebView service for tracking recurring personal consumables: food, pharmacy, cosmetics, home goods, household chemicals, clothing, pets, auto and other replenishable items.

The product is not a classic shopping list. It tracks personal recurring essentials, their status, check cycles, reminders and related-item recommendations.

## Repository layout

- `apps/webapp` - Telegram Mini App / mobile web UI
- `apps/api` - backend API
- `apps/bot` - Telegram bot
- `apps/worker` - reminder scheduler
- `packages/database` - Prisma schema and database utilities
- `packages/shared` - shared types and business logic
- `packages/ui` - reusable UI components
- `docs` - product and technical documentation

## Before starting

- Read `README.md` and `docs/PRODUCT_SPEC.md`.
- Inspect the existing repository before making changes.
- Follow the current architecture and established patterns.
- Report conflicts between implementation and documentation.
- Do not overwrite or revert unrelated user changes.

## Workflow

- Explain the implementation plan before large changes.
- Prefer small incremental changes.
- Ask before destructive or irreversible actions.
- Keep the existing architecture unless a change is justified.
- Do not add production dependencies without explaining why.

## Engineering

- Use TypeScript.
- Prefer explicit types.
- Avoid `any` unless there is a strong reason.
- Keep shared business logic in `packages/shared` where possible.
- Keep UI components simple and mobile-first.
- Do not duplicate status transition logic across frontend and backend.
- Treat the backend as the source of truth.

## Security

- Validate Telegram WebApp init data on the backend.
- Never trust a user id from the request body or query parameters.
- Resolve user identity from the authorization context.
- Never commit secrets.
- Never log Telegram tokens, initData, JWTs or sensitive user notes.
- Keep user data isolated by `userId`.

## Verification

For code changes, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Run `pnpm test:e2e` when changing a user-facing workflow.

If a verification command cannot be run, explain why in the final response.

## Data integrity

- Keep background jobs idempotent.
- Do not create duplicate shopping list entries for the same tracked item.
- Do not modify existing Prisma migrations after they have been applied.
- Preserve unrelated changes made by the user.

## Privacy

- Never enable development authentication in production.
- Do not send user data to third-party LLMs or analytics services without explicit consent.
- Treat medicines, hygiene products and personal notes as sensitive data.

## Documentation

Update documentation when changing:

- API endpoints;
- the data model;
- status transition behavior;
- notification behavior;
- recommendation logic;
- setup instructions.

## Final response

- Summarize the implemented changes.
- List the changed files.
- Report which verification commands were run and their results.
- Mention any tests that could not be run.
- Describe important assumptions or tradeoffs.

## Done means

- Code compiles.
- Tests pass.
- New business logic has tests.
- No secrets are committed.
- README or documentation is updated when needed.
- The final response includes changed files, verification results and important tradeoffs.
