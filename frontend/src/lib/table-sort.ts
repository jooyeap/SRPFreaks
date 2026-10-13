import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 묶음 안의 정렬 기준. 묶음(기준 난이도) 순서는 그대로이고 한 묶음 안의 채보 순서만 바뀐다.
 * 서버가 주는 값을 화면에서 정렬하므로 서버 변경이 없다. 서버의 기본 순서가 "레벨 높은 순"이라서 `level`은 순서를 건드리지 않는다.
 */
export type TableSort = "level" | "rateDesc" | "rateAsc" | "title" | "recommend";

export const SORT_OPTIONS: readonly { value: TableSort; label: string }[] = [
  { value: "level", label: "레벨 높은 순" },
  { value: "rateDesc", label: "내 달성률 높은 순" },
  { value: "rateAsc", label: "내 달성률 낮은 순" },
  { value: "title", label: "곡명 순" },
  { value: "recommend", label: "추천도 순" },
];

export const DEFAULT_SORT: TableSort = "level";

/** 곡명은 일본어(가나)·영문이 섞여 있어서 일본어 기준 비교로 가나다·ABC 순을 안정적으로 맞춘다. 숫자는 크기대로(2가 10보다 앞). */
const titleCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

/** 추천도 순서: 상 > 중 > 하 > 없음. */
const RECOMMEND_RANK: Record<string, number> = { 상: 0, 중: 1, 하: 2 };
const NO_RECOMMEND_RANK = 3;

/**
 * 채보 목록을 정렬한 새 배열을 돌려준다(원본은 건드리지 않는다). 기준이 같은 채보는 서버가 준 순서를 그대로 지킨다(안정 정렬).
 * 달성률 정렬에서 기록이 없는 채보는 올림·내림 어느 쪽이든 맨 뒤로 보낸다.
 */
export function sortEntries(entries: readonly TableEntryResponse[], sort: TableSort): TableEntryResponse[] {
  const copy = [...entries];
  switch (sort) {
    case "level":
      return copy;
    case "rateDesc":
    case "rateAsc": {
      const direction = sort === "rateDesc" ? -1 : 1;
      return copy.sort((a, b) => {
        const ra = a.mine?.rate ?? null;
        const rb = b.mine?.rate ?? null;
        if (ra === null && rb === null) return 0;
        if (ra === null) return 1;
        if (rb === null) return -1;
        return (ra - rb) * direction;
      });
    }
    case "title":
      return copy.sort((a, b) => titleCollator.compare(a.title, b.title));
    case "recommend":
      return copy.sort((a, b) => rank(a.recommend) - rank(b.recommend));
  }
}

function rank(recommend: string | null): number {
  return recommend === null ? NO_RECOMMEND_RANK : (RECOMMEND_RANK[recommend] ?? NO_RECOMMEND_RANK);
}
