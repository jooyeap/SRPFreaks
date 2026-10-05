import { apiFetch } from "@/lib/api";
import type { UserResponse } from "@/lib/api-types";

/** 내 닉네임 변경. null이면 닉네임 없음으로 되돌린다. 규칙은 lib/nickname.ts(서버와 같은 규칙). */
export function updateMyNickname(nickname: string | null): Promise<UserResponse> {
  return apiFetch<UserResponse>("/users/me", { method: "PATCH", body: { nickname } });
}
