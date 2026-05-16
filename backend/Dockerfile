FROM node:24-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

ENV CI=true

COPY . .

RUN pnpm install

CMD ["pnpm", "start"]