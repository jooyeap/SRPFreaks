import { useEffect, useRef } from "react";

/**
 * value(보통 페이지 번호)가 바뀌면 화면을 맨 위로 올린다.
 * 목록의 `다음`을 눌렀을 때 아래쪽 버튼 위치에 머물러 있으면 새 페이지의 첫 줄이 안 보이기 때문이다.
 * 처음 그릴 때는 올리지 않는다(화면을 연 직후 사용자가 있던 위치를 건드리지 않는다).
 */
export function useScrollTopOnChange(value: unknown): void {
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) {
      return;
    }
    previous.current = value;
    window.scrollTo({ top: 0 });
  }, [value]);
}
