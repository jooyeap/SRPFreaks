import type { Role } from "@/lib/api-types";

/**
 * 최근 플레이 가져오기(D34, D40)를 모든 사용자에게 보여 줄지. 2026-10-19에 모두에게 열었다(true).
 * false로 바꾸면 ROOT만 보고 쓴다(서버도 같은 규칙: 서버 환경변수 IMPORT_API_ENABLED=false이면 ROOT만). 문제가 생겨 다시 닫을 때는 이 값과 서버 환경변수를 함께 바꾼다.
 */
export const IMPORT_FEATURE_ENABLED = true;

/** 가져오기 설정 카드·화면을 보여 줄 역할인가. 화면 숨김은 편의일 뿐이고 실제 막는 곳은 서버다. */
export function canUseImport(role: Role | undefined, enabled: boolean = IMPORT_FEATURE_ENABLED): boolean {
  return enabled || role === "ROOT";
}
