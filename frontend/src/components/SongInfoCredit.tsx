import { useTranslations } from "next-intl";
import { SONG_INFO_CREDIT } from "@/lib/credit";
import { FOOTER_CREDIT_LINK } from "@/lib/hit-area";

/**
 * 곡 정보(BPM·아티스트) 출처 표기 한 줄 (D94). RemyWiki의 곡 표에서 사실 데이터(곡명·아티스트·BPM)만 읽어 쓰므로 출처를 밝힌다.
 * 외부 링크는 새 탭으로 열고 noopener를 붙인다(TableCredit과 같은 스타일).
 */
export function SongInfoCredit({ className, tall = false }: { className?: string; tall?: boolean }) {
  const t = useTranslations("Footer");
  return (
    <p className={className}>
      {t("songInfoCredit")}{" "}
      <a
        href={SONG_INFO_CREDIT.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-words underline underline-offset-2 hover:text-fg ${tall ? FOOTER_CREDIT_LINK : ""}`}
      >
        {SONG_INFO_CREDIT.name}
      </a>
    </p>
  );
}
