"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScoreDiffChip } from "@/components/rivals/ScoreDiffChip";
import { useToast } from "@/components/Toast";
import { ChartLine } from "@/components/table/ChartLine";
import { ApiError } from "@/lib/api";
import type { RivalRatingRow } from "@/lib/api-types";
import type { useJackets } from "@/lib/jackets";
import { catchUpRows } from "@/lib/rivals";
import { addToSetlist, fetchSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";
import { useTranslations } from "next-intl";

/**
 * 따라잡을 곡(D66): 라이벌 비교 화면의 레이팅 목록 위에, 내가 뒤진 곡 중 차이가 작은 순으로 최대 3곡을 보여 준다.
 * 둘 다 기록이 있는 곡만 센다(상대 목록 줄 중 내 점수가 있는 것). 뒤진 곡이 하나도 없으면 구역 전체를 그리지 않는다.
 * 선택·정렬은 `catchUpRows`(lib/rivals.ts)가 하고, 점수와 차이는 서버가 계산한 값을 그대로 쓴다. 서버 변경은 없다.
 *
 * 줄은 공통 줄(ChartLine, D64) + 오른쪽 열(위에서부터 차이 칩 `−1.85`(주황, 부호가 글자) / `담기`·`담김`).
 * 담기는 한 곡씩이다(한꺼번에 담기 버튼은 없다, D36). 담김 여부와 30곡 한도는 세트리스트 추천 줄과 같은 방식으로 정한다:
 * 세트리스트 전체 응답(최대 30줄, 쿼리 키가 같아 요청은 하나)에서 이 채보가 있는지로 본다. 담긴 곡의 `담김`은 눌리지 않는다(빼기는 세트리스트 탭에서).
 */
export function CatchUpSection({
  viewerId,
  rows,
  jackets,
}: {
  viewerId: number;
  rows: readonly RivalRatingRow[];
  jackets: ReturnType<typeof useJackets>;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const picked = catchUpRows(rows);

  const list = useQuery({ queryKey: setlistKeys.list(viewerId), queryFn: ({ signal }) => fetchSetlist(signal), enabled: picked.length > 0 });
  const items = list.data?.content ?? [];
  const addedIds = new Set(items.map((item) => item.songDifficultyId));
  const full = items.length >= SETLIST_LIMIT;

  const add = useMutation({
    mutationFn: (songDifficultyId: number) => addToSetlist(songDifficultyId),
    onSuccess: async () => {
      toast(t("Setlist.added"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    // 30곡이 찼거나 이미 담긴 경우 등 서버가 거절한 문구를 그대로 보여 준다
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed"), { kind: "error" }),
  });

  if (picked.length === 0) return null;

  return (
    <section aria-label={t("Rival.catchUpTitle")} className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-bold text-fg">{t("Rival.catchUpTitle")}</h2>
        <p className="text-xs text-fg-dim">{t("Rival.catchUpDesc", { n: picked.length })}</p>
      </div>
      <ul aria-label={t("Rival.catchUpTitle")} className="overflow-hidden rounded-2xl border border-line bg-card">
        {picked.map((row) => {
          const added = addedIds.has(row.songDifficultyId);
          const pending = add.isPending && add.variables === row.songDifficultyId;
          return (
            <ChartLine
              key={row.songDifficultyId}
              className="border-t border-row-line first:border-t-0"
              jacket={jackets.visible ? { url: jackets.urlOf(row.songId) } : null}
              pattern={row.pattern}
              tier={row.tier}
              title={row.title}
              href={`/songs/${row.songId}?chart=${row.songDifficultyId}`}
              part={row.part}
              difficulty={row.difficulty}
              level={row.level}
              // 오른쪽: 차이 칩 위, `담기`/`담김` 아래. 보이는 높이 26px, ::after로 눌리는 영역만 사방 6px 넓힌다. `담김`은 초록 테두리 + 초록 글자(글자로도 구분된다)
              aside={
                <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5">
                  <ScoreDiffChip diff={row.diff} />
                  <button
                    type="button"
                    disabled={added || full || list.isPending || pending}
                    onClick={() => add.mutate(row.songDifficultyId)}
                    aria-label={added ? t("Setlist.addedAria", { title: row.title }) : t("Setlist.addAria", { title: row.title })}
                    title={full && !added ? t("Setlist.limitFull", { limit: SETLIST_LIMIT }) : undefined}
                    className={`relative flex h-[26px] w-full items-center justify-center rounded-md border px-1 text-xs after:absolute after:-inset-1.5 after:content-[''] ${
                      added ? "border-done text-done-text" : "border-ctl text-fg enabled:hover:bg-table-head disabled:text-disabled"
                    }`}
                  >
                    {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
                  </button>
                </div>
              }
            />
          );
        })}
      </ul>
    </section>
  );
}
