"use client";

import { useQuery } from "@tanstack/react-query";
import { canSuggest, fetchSongSuggestions, songSuggestKeys } from "@/lib/song-suggest";
import { useTranslations } from "next-intl";

/**
 * 검색 결과가 비었을 때 "혹시 이 곡인가요?" 후보를 보여 준다 (오타·히라가나/가타카나 차이를 서버가 보정한다).
 * 후보를 누르면 그 곡명으로 다시 검색하도록 부모에게 알린다(onPick). 후보가 없거나 실패하면 아무것도 그리지 않는다 —
 * 보조 기능이라 실패가 본 화면의 안내("찾지 못했습니다")를 가리면 안 된다.
 */
export function SongSuggestions({ query, onPick }: { query: string; onPick: (title: string) => void }) {
  const t = useTranslations();
  const suggest = useQuery({
    queryKey: songSuggestKeys.query(query.trim()),
    queryFn: ({ signal }) => fetchSongSuggestions(query, signal),
    enabled: canSuggest(query),
  });
  const items = Array.isArray(suggest.data) ? suggest.data : [];
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="mt-3">
      <p className="text-sm text-fg-sub">{t("Songs.didYouMean")}</p>
      <ul aria-label={t("Songs.suggestionsAria")} className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.songId}>
            <button
              type="button"
              onClick={() => onPick(item.title)}
              className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg hover:border-fg-sub"
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
