import { SongJacket } from "@/components/SongJacket";
import type { RivalTopSong } from "@/lib/api-types";
import { formatScore } from "@/lib/format";
import { useJackets } from "@/lib/jackets";
import { useTranslations } from "next-intl";

/**
 * 라이벌 카드의 `상대 상위 곡`(3단계, D65): 상대 레이팅 목록에서 점수가 높은 곡의 재킷 5개를 가로 한 줄로, 재킷 아래에 그 곡의 점수.
 * 재킷이 꺼져 있으면(운영 설정 + 개인 `재킷 표시`) 이 줄 전체를 숨긴다: 점수만 있는 줄은 어느 곡인지 알 수 없어 의미가 약하다.
 * 곡이 5곡 미만이면 있는 만큼만 그리고(칸 크기는 같게 왼쪽부터), 하나도 없거나 구버전 응답(필드 없음)이면 그리지 않는다.
 * 재킷은 장식이 아닌 곡의 그림이지만 곡명을 받지 않아(응답에 곡 id와 점수만 있다) alt는 비운다. 점수 글자는 그대로 읽힌다.
 * 타일은 56px까지 커지고 좁은 폭(360px)에서는 5칸이 줄어들어 가로로 넘치지 않는다.
 */
export function RivalTopSongs({ songs }: { songs: RivalTopSong[] | null | undefined }) {
  const t = useTranslations("Rival");
  const jackets = useJackets();
  if (!jackets.visible || !songs || songs.length === 0) {
    return null;
  }
  return (
    <span role="group" aria-label={t("topSongs")} className="flex flex-col gap-1.5">
      <span className="text-[11px] text-fg-dim">{t("topSongs")}</span>
      <span className="grid grid-cols-5 gap-1.5">
        {songs.map((song) => (
          <span key={song.songId} className="flex min-w-0 flex-col items-center gap-1">
            <SongJacket url={jackets.urlOf(song.songId)} className="aspect-square w-full max-w-14 rounded-lg" />
            <span className="font-num text-[11px] tabular-nums text-fg-sub">{formatScore(song.score)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
