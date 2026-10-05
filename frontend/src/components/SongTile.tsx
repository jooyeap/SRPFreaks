import { tileInitial, tileSpec } from "@/lib/tile";

/**
 * 생성 타일: 재킷 이미지 대신 곡마다 다른 색·무늬 칸 (DESIGN-UI 8장).
 * 색 쌍과 무늬는 data-palette / data-pattern에 따라 globals.css가 정한다. 컴포넌트에는 색 값이 없고,
 * 각도만 CSS 변수(--tile-angle)로 넘긴다. 장식이라서 스크린리더에는 숨긴다.
 * title을 넘기면 곡명 첫 글자를 얹는다 (큰 타일에서만 쓴다. 색만으로 곡을 구분하지 않기 위해서다).
 */
export function SongTile({
  songId,
  title,
  className = "",
  children,
}: {
  songId: number;
  title?: string;
  /** 크기·모서리 등 배치 클래스 (예: "h-11 w-11 rounded-lg") */
  className?: string;
  /** 타일 위에 얹는 요소 (레벨 표시, 난이도 띠 등) */
  children?: React.ReactNode;
}) {
  const spec = tileSpec(songId);
  const initial = title ? tileInitial(title) : "";
  return (
    <div
      aria-hidden="true"
      data-palette={spec.palette}
      data-pattern={spec.pattern}
      style={{ "--tile-angle": `${spec.angle}deg` } as React.CSSProperties}
      className={`song-tile relative shrink-0 overflow-hidden ${className}`}
    >
      {initial ? (
        <span className="absolute inset-0 flex items-center justify-center font-num text-3xl font-bold text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,.35)]">
          {initial}
        </span>
      ) : null}
      {children}
    </div>
  );
}
