import { apiFetch } from "@/lib/api";
import type { UserResponse } from "@/lib/api-types";

/** 내 닉네임 변경. null이면 닉네임 없음으로 되돌린다. 규칙은 lib/nickname.ts(서버와 같은 규칙). */
export function updateMyNickname(nickname: string | null): Promise<UserResponse> {
  return apiFetch<UserResponse>("/users/me", { method: "PATCH", body: { nickname } });
}

/** 회원 탈퇴(완전 삭제, D20). 성공하면 204이고 서버가 refresh 쿠키도 지운다. 호출한 뒤에는 이 기기의 로그인 상태도 정리해야 한다. */
export function withdrawMyAccount(): Promise<void> {
  return apiFetch<void>("/users/me", { method: "DELETE" });
}

/**
 * 유저 목록 공개 여부 변경(D26). 닉네임이 없으면 서버가 400으로 거부한다(화면에서도 먼저 막는다).
 * 닉네임 변경 API와 따로 둔 이유: 닉네임 요청은 값이 비면 "닉네임 삭제"라서 공개 값만 보내면 닉네임이 지워질 수 있다.
 */
export function updateMyVisibility(profilePublic: boolean): Promise<UserResponse> {
  return apiFetch<UserResponse>("/users/me/visibility", { method: "PATCH", body: { profilePublic } });
}
