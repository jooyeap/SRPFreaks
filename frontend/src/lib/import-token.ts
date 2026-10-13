import { apiFetch } from "@/lib/api";

/** 내 가져오기 토큰 상태(D34). 원문은 내려오지 않는다. 토큰이 없으면 exists=false이고 시각은 null. */
export interface ImportTokenStatus {
  exists: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** 발급 직후 한 번만 내려오는 응답. token 원문은 다시 조회할 수 없다. */
export interface ImportTokenIssued {
  token: string;
  createdAt: string;
}

export const importTokenKeys = {
  status: (userId: number) => ["import-token", userId] as const,
};

export function fetchImportTokenStatus(): Promise<ImportTokenStatus> {
  return apiFetch<ImportTokenStatus>("/import-token");
}

/** 발급(이미 있으면 이전 토큰은 폐기된다). */
export function issueImportToken(): Promise<ImportTokenIssued> {
  return apiFetch<ImportTokenIssued>("/import-token", { method: "POST" });
}

export function revokeImportToken(): Promise<void> {
  return apiFetch<void>("/import-token", { method: "DELETE" });
}
