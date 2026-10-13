"use client";

import { useEffect, useState } from "react";

const DEBOUNCE_MS = 300;

/**
 * 검색창. 입력할 때마다 서버를 부르지 않도록 입력이 멈춘 뒤(300ms) 값을 올려 보낸다.
 * 값(value)이 밖에서 바뀌면(뒤로 가기 등) 입력칸도 맞춘다. 검색어를 비우면 폴더 목록으로 돌아간다 (DESIGN-UI 9장).
 */
export function SongSearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  // 밖의 값이 바뀌었을 때만 입력칸을 맞춘다. effect 대신 렌더 중에 이전 값과 비교하는 방식(React 권장)을 쓴다.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) {
      return;
    }
    const timer = setTimeout(() => onCommit(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value, onCommit]);

  return (
    <input
      type="search"
      value={text}
      maxLength={100}
      onChange={(e) => setText(e.target.value)}
      placeholder="곡명, 아티스트 검색 (한글·일본어·로마자)"
      aria-label="곡 검색"
      className="min-w-0 flex-1 rounded-full border border-chip-line bg-card px-4 py-2 text-sm text-fg placeholder:text-fg-dim"
    />
  );
}
