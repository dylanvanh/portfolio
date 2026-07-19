FROM node:24-alpine AS builder

RUN npm install -g pnpm@11.10.0

WORKDIR /app

COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
