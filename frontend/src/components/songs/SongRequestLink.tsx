import Link from "next/link";

/**
 * 검색해도 곡이 없을 때 건의하기 화면으로 보내는 링크. 종류(곡 추가)와 제목(검색어)을 주소 쿼리로 미리 채워 준다.
 * 곡을 자동으로 등록하지는 않는다 — 건의는 관리자가 읽고 직접 등록한다.
 */
export function SongRequestLink({ query }: { query: string }) {
  const title = query.trim().slice(0, 100);
  const params = new URLSearchParams({ category: "SONG_REQUEST" });
  if (title) {
    params.set("title", title);
  }
  return (
    <p className="mt-3 text-sm text-fg-sub">
      찾는 곡이 없나요?{" "}
      <Link href={`/suggestions?${params.toString()}`} className="underline">
        곡 추가 건의하기
      </Link>
    </p>
  );
}
