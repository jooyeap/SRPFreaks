import type { NextConfig } from "next";

/**
 * 개발 중 /api/* 요청을 백엔드로 넘긴다 (rewrite).
 *
 * 브라우저는 항상 같은 주소(localhost:3000)로만 요청하므로 CORS가 필요 없고, Refresh 쿠키(SameSite=Strict,
 * Path=/api/v1/auth)도 그대로 따라간다. 운영에서도 "같은 도메인 + 리버스 프록시가 /api를 백엔드로 보냄"
 * (D20-3)이라 같은 모양이다.
 *
 * 백엔드 주소는 서버 쪽 환경변수 BACKEND_URL로 바꿀 수 있다 (기본 http://localhost:8080).
 * NEXT_PUBLIC_ 접두사가 없으므로 브라우저 코드에는 노출되지 않는다.
 */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // 배포용: 실행에 필요한 파일만 .next/standalone 에 모아 준다. Docker 이미지에 node_modules 전체를 넣지 않아도 된다.
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
