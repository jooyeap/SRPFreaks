/**
 * 생성 타일 규칙 (DESIGN-UI 8장): 곡 ID가 같으면 항상 같은 타일이 나온다.
 * 무작위가 아니라 곡 ID를 섞은 숫자(hash)에서 색 쌍, 패턴, 각도를 꺼내기 때문이다.
 * 색 쌍과 패턴 모양은 globals.css가 정한다 (여기에는 번호만 있다).
 *
 * 설계서는 색 쌍을 곡의 "버전"으로 고르라고 하지만, 레이팅 응답에는 버전이 없어서 같은 곡이 화면마다 다른 타일이 될 수 있다.
 * 그래서 지금은 곡 ID 하나로 모두 고른다. 레이팅 응답에 버전이 생기면 팔레트만 버전으로 바꿀 수 있다 (패턴·각도는 그대로).
 */
export const PALETTE_COUNT = 5;
export const PATTERNS = ["plain", "stripes", "rings", "dots", "split", "beams"] as const;
export type TilePattern = (typeof PATTERNS)[number];

export interface TileSpec {
  palette: number; // 0 ~ 4
  pattern: TilePattern;
  angle: number; // 0 ~ 359 (도)
}

/** 정수를 잘 섞는 해시 (Knuth 곱셈). 결과는 부호 없는 32비트 정수. */
function mix(id: number): number {
  return Math.imul(id | 0, 2654435761) >>> 0;
}

export function tileSpec(songId: number): TileSpec {
  const h = mix(songId);
  return {
    palette: h % PALETTE_COUNT,
    pattern: PATTERNS[(h >>> 4) % PATTERNS.length],
    angle: (h >>> 9) % 360,
  };
}

/** 타일 위에 얹는 곡명 첫 글자. 공백뿐이거나 비어 있으면 빈 문자열. */
export function tileInitial(title: string): string {
  const first = Array.from(title.trim())[0];
  return first ? first.toUpperCase() : "";
}
