# ---------- 1단계: 의존성 ----------
FROM node:22-alpine AS deps
WORKDIR /app
# package*.json만 먼저 복사해 둔다. 소스가 바뀌어도 이 층은 캐시되어 다시 설치하지 않는다.
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2단계: 빌드 ----------
FROM node:22-alpine AS build
WORKDIR /app
# 아래 두 값은 "빌드할 때" 코드에 고정된다. 실행 중 환경변수로는 바꿀 수 없다.
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID: 브라우저 코드에 들어간다 (공개돼도 되는 값)
# - BACKEND_URL: /api 요청을 넘길 백엔드 주소. compose 안에서는 서비스 이름으로 부른다
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG BACKEND_URL=http://backend:8080
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN npm run build

# ---------- 3단계: 실행 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone 출력에는 서버와 필요한 모듈만 들어 있다. 정적 파일과 public은 따로 복사한다
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# root가 아닌 기본 제공 사용자(node)로 실행한다
USER node
EXPOSE 3000

# localhost는 alpine에서 IPv6(::1)로 먼저 풀리는데 Next 서버는 IPv4(0.0.0.0)만 열어서 연결이 거부된다. 그래서 127.0.0.1로 부른다
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
