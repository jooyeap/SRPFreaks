import { useSyncExternalStore } from "react";

/**
 * 인터넷 연결 여부(브라우저가 알려 주는 값). 오락실처럼 전파가 약한 곳에서 저장이 실패했을 때 "서버 문제"가 아니라
 * "연결이 끊김"이라고 알려 주려고 쓴다. navigator.onLine은 "연결 있음"을 완전히 보장하지는 않지만(와이파이는 붙었는데 인터넷이 안 되는 경우),
 * "연결 없음"은 정확해서 끊김 안내에는 충분하다. 서버 렌더링 값은 항상 true(연결됨)다.
 */
function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
