"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchTitleCheck } from "@/lib/song-admin";

/** 입력을 멈추고 이만큼 지나면 확인한다(글자를 칠 때마다 서버를 부르지 않으려는 것) */
const DEBOUNCE_MS = 400;

/**
 * 곡명 입력칸 아래의 중복 경고(곡 등록·수정 창). 이름이 이미 있는 곡과 같으면 그 곡으로 가는 링크와 함께 알린다.
 * 서버가 등록·수정 때 같은 검사를 다시 하므로(409) 이 경고는 미리 알려 주는 용도이고, 저장을 막지는 않는다.
 * 경고는 글자(⚠)로도 나타낸다(색만으로 전달하지 않는다). 확인에 실패하면(네트워크 등) 조용히 아무것도 보이지 않는다.
 * excludeSongId: 수정할 때 자기 곡은 중복으로 보지 않는다.
 */
export function TitleDuplicateNotice({ title, excludeSongId = null }: { title: string; excludeSongId?: number | null }) {
  const t = useTranslations();
  const trimmed = title.trim();
  const [settled, setSettled] = useState(trimmed);

  useEffect(() => {
    const id = setTimeout(() => setSettled(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trimmed]);

  const check = useQuery({
    queryKey: ["song-title-check", settled, excludeSongId],
    queryFn: ({ signal }) => fetchTitleCheck(settled, excludeSongId, signal),
    enabled: settled.length > 0,
    staleTime: 0, // 다른 곡을 지운 직후 다시 확인해도 낡은 결과가 보이지 않게
    gcTime: 0,
    retry: false,
  });

  // 입력이 아직 바뀌는 중이면(마지막 확인 이후 글자가 달라졌으면) 이전 결과를 보여 주지 않는다
  if (settled !== trimmed || !check.data?.duplicate || check.data.songId === null) {
    return null;
  }
  return (
    <p role="status" className="text-sm font-bold text-fg">
      {t.rich("Song.titleDuplicate", {
        title: check.data.title ?? "",
        l: (chunks) => (
          <Link href={`/songs/${check.data.songId}?from=songs`} className="underline">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
