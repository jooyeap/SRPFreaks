import type { Role } from "@/lib/api-types";

/**
 * 최근 플레이 가져오기(D34)를 모든 사용자에게 보여 줄지. 공식 페이지에서 동작을 확인하기 전까지 꺼 둔다.
 * 꺼 두면 ROOT만 보고 쓴다(서버도 같은 규칙: 토큰 발급은 ROOT만). 모두에게 열 때: 이 값을 true로 바꾸고 서버 환경변수 IMPORT_API_ENABLED=true도 같이 켠다.
 */
export const IMPORT_FEATURE_ENABLED = false;

/** 가져오기 설정 카드·화면을 보여 줄 역할인가. 화면 숨김은 편의일 뿐이고 실제 막는 곳은 서버다. */
export function canUseImport(role: Role | undefined): boolean {
  return IMPORT_FEATURE_ENABLED || role === "ROOT";
}
