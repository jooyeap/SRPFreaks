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
