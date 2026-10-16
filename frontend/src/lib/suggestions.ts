import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type {
  AdminSuggestionResponse,
  PageResponse,
  SuggestionCategory,
  SuggestionResponse,
  SuggestionStatus,
} from "@/lib/api-types";

export const suggestionKeys = {
  all: ["suggestions"] as const,
  mine: (viewerId: number, page: number) => ["suggestions", "mine", viewerId, page] as const,
  admin: (viewerId: number, category: SuggestionCategory | "", status: SuggestionStatus | "", page: number) =>
    ["suggestions", "admin", viewerId, category, status, page] as const,
  receivedCount: (viewerId: number) => ["suggestions", "received-count", viewerId] as const,
};

export const SUGGESTIONS_PAGE_SIZE = 10;
// 서버(Suggestion 엔티티)와 같은 길이 제한이다. 서버도 다시 검사한다.
export const SUGGESTION_TITLE_MAX = 100;
export const SUGGESTION_CONTENT_MAX = 2000;
export const SUGGESTION_NOTE_MAX = 500;

/** 화면에 보이는 순서. 곡 추가가 가장 많이 쓰일 것이라 맨 앞이다. */
export const SUGGESTION_CATEGORIES: readonly SuggestionCategory[] = ["SONG_REQUEST", "IMPROVEMENT", "BUG", "OTHER"];
export const SUGGESTION_STATUSES: readonly SuggestionStatus[] = ["RECEIVED", "REVIEWING", "DONE", "REJECTED"];

export const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  SONG_REQUEST: "곡 추가",
  IMPROVEMENT: "개선사항",
  BUG: "버그 제보",
  OTHER: "기타",
};

export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  RECEIVED: "접수",
  REVIEWING: "확인 중",
  DONE: "처리 완료",
  REJECTED: "반려",
};

/** 주소 쿼리의 종류 값을 안전하게 읽는다. 모르는 값이면 null이라 폼은 기본값을 쓴다. */
export function parseCategory(value: string | null): SuggestionCategory | null {
  return SUGGESTION_CATEGORIES.find((category) => category === value) ?? null;
}

/** 건의 보내기 폼 검증. 서버는 앞뒤 공백을 잘라 저장하므로 공백만 있는 값은 빈 값으로 본다. */
export const suggestionSchema = z.object({
  category: z.enum(["SONG_REQUEST", "IMPROVEMENT", "BUG", "OTHER"], { message: "종류를 선택해 주세요." }),
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(SUGGESTION_TITLE_MAX, `제목은 ${SUGGESTION_TITLE_MAX}자 이하여야 합니다.`),
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력해 주세요.")
    .max(SUGGESTION_CONTENT_MAX, `내용은 ${SUGGESTION_CONTENT_MAX}자 이하여야 합니다.`),
});
export type SuggestionValues = z.infer<typeof suggestionSchema>;

export function createSuggestion(values: SuggestionValues): Promise<SuggestionResponse> {
  return apiFetch<SuggestionResponse>("/suggestions", { method: "POST", body: values });
}

export function fetchMySuggestions(
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<PageResponse<SuggestionResponse>> {
  return apiFetch<PageResponse<SuggestionResponse>>("/suggestions/me", { query: { page, size }, signal });
}

// 아래 셋은 ADMIN·ROOT만 부를 수 있다. 권한은 서버가 검사하고, 화면은 보일지만 정한다.
export function fetchAdminSuggestions(
  filters: { category: SuggestionCategory | ""; status: SuggestionStatus | "" },
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<PageResponse<AdminSuggestionResponse>> {
  return apiFetch<PageResponse<AdminSuggestionResponse>>("/admin/suggestions", {
    query: { category: filters.category || undefined, status: filters.status || undefined, page, size },
    signal,
  });
}

export function fetchReceivedCount(signal?: AbortSignal): Promise<{ received: number }> {
  return apiFetch<{ received: number }>("/admin/suggestions/received-count", { signal });
}

export function reviewSuggestion(
  id: number,
  body: { status: SuggestionStatus; adminNote: string },
): Promise<AdminSuggestionResponse> {
  return apiFetch<AdminSuggestionResponse>(`/admin/suggestions/${id}`, { method: "PATCH", body });
}
