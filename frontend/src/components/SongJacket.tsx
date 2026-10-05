/**
 * 재킷 자리 (DESIGN-UI 8장 "지금(임시)"): 모든 곡이 같은 단색 칸이다. 공식 재킷 이미지는 쓰지 않는다 (DESIGN.md 15장).
 * 나중에 이미지를 쓰게 되면(songs.image_url + ui.show_song_images) 이 컴포넌트 한 곳만 고치면 되도록 자리를 한 곳에 모아 뒀다.
 * 장식이라서 스크린리더에는 숨긴다.
 */
export function SongJacket({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" className={`relative shrink-0 overflow-hidden bg-jacket ${className}`}>
      {children}
    </div>
  );
}
