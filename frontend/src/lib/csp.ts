/**
 * 화면(HTML)에 붙이는 Content-Security-Policy. XSS로 악성 코드가 끼어들어도 피해를 줄이려는 "한 겹 더"의 방어다.
 *
 * - 스크립트는 우리 도메인('self')과 Google 로그인(accounts.google.com/gsi/client)에서만 받는다. 다른 외부 주소에서 스크립트를
 *   불러오거나, 데이터를 외부로 몰래 보내는(connect-src) 것, <object>/<base> 삽입, 다른 사이트에서 이 화면을 iframe으로
 *   띄우는 것(frame-ancestors)을 막는다.
 * - 'unsafe-inline'을 script-src에 둔 이유: Next가 화면 데이터를 인라인 스크립트로 내려보내고, 테마 깜빡임 방지 스크립트도
 *   인라인이다. 이것까지 막으려면 요청마다 nonce를 만들어야 하고 모든 페이지가 동적 렌더링으로 바뀐다. 그래서 지금은
 *   "출처 제한"까지만 하고, nonce 방식은 나중에 필요해지면 검토한다.
 * - 개발 서버(npm run dev)는 React 개발 도구가 eval과 웹소켓을 써서 그 부분만 열어 준다. 운영 빌드에는 들어가지 않는다.
 * - upgrade-insecure-requests는 넣지 않았다. http://localhost 로컬 확인이 깨지고, 운영의 HTTPS는 nginx(HSTS)가 이미 강제한다.
 */
const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_STYLE = "https://accounts.google.com/gsi/style";
const GOOGLE_GSI = "https://accounts.google.com/gsi/";

export function buildContentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", GOOGLE_SCRIPT, ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", GOOGLE_STYLE],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", GOOGLE_GSI, ...(isDev ? ["ws:", "wss:"] : [])],
    "frame-src": [GOOGLE_GSI],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
