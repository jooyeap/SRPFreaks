/**
 * Access 토큰 보관소. 토큰은 이 모듈의 변수(= 브라우저 메모리)에만 둔다.
 *
 * 왜 localStorage/sessionStorage에 저장하지 않는가 (CLAUDE.md 보안 원칙):
 * 저장소에 있는 값은 같은 페이지에서 실행되는 모든 스크립트가 읽을 수 있다. 화면에 악성 스크립트가
 * 끼어들면(XSS) 토큰이 그대로 빠져나간다. 메모리 변수는 새로고침하면 사라지지만, 그때는 httpOnly 쿠키에 든
 * Refresh 토큰으로 다시 발급받으면 되므로 불편하지 않다 (api.ts의 refreshSession).
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * 메모리의 Access 토큰이 만료됐거나 곧(skewMs 안에) 만료되는지 본다. 토큰 가운데 부분(payload)의 `exp`(초)를 읽을 뿐이고,
 * 서명 검증은 서버가 한다(여기서 읽은 값으로 권한을 정하지 않는다. "지금 재발급하는 게 좋은가"만 정한다).
 *
 * 왜 필요한가: 곡 목록·서열표처럼 로그인 없이도 읽히는 경로(D43)는 만료된 토큰을 받으면 401이 아니라 "비로그인으로 보고"
 * 200을 돌려준다. 그러면 api.ts의 "401 → 재발급" 흐름이 돌지 않아 내 기록이 빠진 화면이 그대로 보인다.
 * 그래서 요청을 보내기 전에 만료를 먼저 확인한다. 토큰이 없거나 형식을 읽을 수 없으면 false(서버 판단에 맡긴다).
 */
export function isAccessTokenExpiring(skewMs = 30_000, now = Date.now()): boolean {
  if (!accessToken) {
    return false;
  }
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return false;
    }
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { exp?: unknown };
    return typeof json.exp === "number" && json.exp * 1000 - skewMs <= now;
  } catch {
    return false;
  }
}
