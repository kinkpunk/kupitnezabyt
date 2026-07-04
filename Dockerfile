FROM node:22-alpine

WORKDIR /app

ENV API_PORT=3001
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/webapp/package.json apps/webapp/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack pnpm install --frozen-lockfile --prod=false

COPY . .

RUN corepack pnpm db:generate \
  && corepack pnpm --filter @kupitnezabyt/shared build \
  && corepack pnpm --filter @kupitnezabyt/database build \
  && corepack pnpm --filter @kupitnezabyt/api build

EXPOSE 3001

CMD ["corepack", "pnpm", "--filter", "@kupitnezabyt/api", "start"]
