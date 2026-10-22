import type { MessageKey, Translator } from "@/i18n/translator";

/**
 * 컴포넌트 밖에서 만들어지는 오류 문구(네트워크 끊김, 구글 스크립트 로딩 실패 등)를 위한 번역기 보관소.
 * 훅을 쓸 수 없는 곳이라 `Providers`가 현재 언어의 번역기를 여기에 등록해 둔다.
 *
 * 렌더링 중에 쓰면 안 된다: 서버에서는 요청마다 언어가 다른데 이 변수는 하나뿐이라 섞인다.
 * 그래서 브라우저에서만 일어나는 일(fetch 실패, 스크립트 로딩)의 오류 문구에만 쓴다.
 * 등록 전(첫 렌더 직전, 테스트)에는 호출한 쪽이 준 한국어 기본 문구를 쓴다.
 */
let current: Translator | null = null;

export function setClientTranslator(t: Translator | null): void {
  current = t;
}

export function clientMessage(key: MessageKey, fallback: string): string {
  return current ? current(key) : fallback;
}
