/**
 * 재킷 칸 (D54, DESIGN-UI 8장). 주소가 있으면 우리 사이트의 재킷 이미지(`/jackets/…webp`), 없으면 같은 크기의 단색 칸이다.
 * 칸을 그릴지(운영 설정 + 개인 `재킷 표시`)는 부르는 쪽이 useJackets().visible로 정한다.
 * 이미지는 장식이 아니라 곡의 그림이라 alt에 곡명을 넣는다(곡명 글자가 옆에 있어 읽기 프로그램에는 alt를 비워도 되지만, 이미지만 보이는 칸을 대비).
 * 크기는 className으로 고정해 레이아웃이 흔들리지 않게 하고, 화면 밖은 늦게 불러온다(lazy).
 */
export function SongJacket({
  url = null,
  title = "",
  className = "",
  children,
}: {
  url?: string | null;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div aria-hidden={url ? undefined : true} className={`relative shrink-0 overflow-hidden bg-jacket ${className}`}>
      {url ? (
        // 우리 사이트의 작은 고정 크기 이미지라 next/image의 최적화가 필요 없다(외부 주소를 불러오지 않는다)
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {children}
    </div>
  );
}
