import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type {
  AdminSuggestionResponse,
  PageResponse,
  SuggestionCategory,
  SuggestionResponse,
  SuggestionStatus,
} from "@/lib/api-types";
import { difficultyLabel, partLabel } from "@/lib/format";
import type { DifficultyType, InstrumentPart } from "@/lib/types";
import type { Translator } from "@/i18n/translator";
import type { MessageKey } from "@/i18n/translator";

export const suggestionKeys = {
  all: ["suggestions"] as const,
  mine: (viewerId: number, page: number, size: number) => ["suggestions", "mine", viewerId, page, size] as const,
  admin: (viewerId: number, category: SuggestionCategory | "", status: SuggestionStatus | "", page: number, size: number) =>
    ["suggestions", "admin", viewerId, category, status, page, size] as const,
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

/** 종류·상태 이름은 번역 키다. 화면에서 `t(CATEGORY_LABELS[x])`로 풀어 쓴다. */
export const CATEGORY_LABELS: Record<SuggestionCategory, MessageKey> = {
  SONG_REQUEST: "Suggestions.catSongRequest",
  IMPROVEMENT: "Suggestions.catImprovement",
  BUG: "Suggestions.catBug",
  OTHER: "Suggestions.catOther",
};

export const STATUS_LABELS: Record<SuggestionStatus, MessageKey> = {
  RECEIVED: "Suggestions.statusReceived",
  REVIEWING: "Suggestions.statusReviewing",
  DONE: "Suggestions.statusDone",
  REJECTED: "Suggestions.statusRejected",
};

/** 주소 쿼리의 종류 값을 안전하게 읽는다. 모르는 값이면 null이라 폼은 기본값을 쓴다. */
export function parseCategory(value: string | null): SuggestionCategory | null {
  return SUGGESTION_CATEGORIES.find((category) => category === value) ?? null;
}

const PARTS: readonly InstrumentPart[] = ["GUITAR", "BASS"];
const DIFFICULTIES: readonly DifficultyType[] = ["BASIC", "ADVANCED", "EXTREME", "MASTER"];

/**
 * 주소 쿼리의 파트·난이도를 안전하게 읽는다. 둘 다 올바른 값일 때만 한 쌍으로 돌려주고, 하나라도 이상하면 null이다
 * (서버도 한 쌍이 아니면 400이라, 화면에서 먼저 걸러 이상한 주소로 폼이 막히지 않게 한다).
 */
export function parseChartRequest(
  part: string | null,
  difficulty: string | null,
): { part: InstrumentPart; difficulty: DifficultyType } | null {
  const p = PARTS.find((value) => value === part);
  const d = DIFFICULTIES.find((value) => value === difficulty);
  return p && d ? { part: p, difficulty: d } : null;
}

/** 요청 채보 표기: `Guitar | MAS`. 가져오기 결과 화면의 표기와 같다. */
export function describeChartRequest(part: InstrumentPart, difficulty: DifficultyType): string {
  return `${partLabel(part)} | ${difficultyLabel(difficulty)}`;
}

/** 건의 보내기 폼 검증. 서버는 앞뒤 공백을 잘라 저장하므로 공백만 있는 값은 빈 값으로 본다. */
export function makeSuggestionSchema(t: Translator) {
  return z.object({
    category: z.enum(["SONG_REQUEST", "IMPROVEMENT", "BUG", "OTHER"], { message: t("Validation.categoryRequired") }),
    title: z
      .string()
      .trim()
      .min(1, t("Validation.titleRequired"))
      .max(SUGGESTION_TITLE_MAX, t("Validation.titleMax", { max: SUGGESTION_TITLE_MAX })),
    content: z
      .string()
      .trim()
      .min(1, t("Validation.contentRequired"))
      .max(SUGGESTION_CONTENT_MAX, t("Validation.contentMax", { max: SUGGESTION_CONTENT_MAX })),
    // 곡 추가 건의에 붙는 요청 채보. 폼에서 고르지 않고 가져오기 링크가 채워 주며, 한 쌍으로만 보낸다.
    requestedPart: z.enum(["GUITAR", "BASS"]).nullish(),
    requestedDifficulty: z.enum(["BASIC", "ADVANCED", "EXTREME", "MASTER"]).nullish(),
  });
}
export type SuggestionValues = z.infer<ReturnType<typeof makeSuggestionSchema>>;

export function createSuggestion(values: SuggestionValues): Promise<SuggestionResponse> {
  // 요청 채보는 곡 추가 건의에서만, 그리고 한 쌍일 때만 보낸다. 종류를 바꿨는데 값이 남아 있어도 서버 400을 만들지 않는다.
  const withChart = values.category === "SONG_REQUEST" && values.requestedPart && values.requestedDifficulty;
  return apiFetch<SuggestionResponse>("/suggestions", {
    method: "POST",
    body: {
      category: values.category,
      title: values.title,
      content: values.content,
      requestedPart: withChart ? values.requestedPart : null,
      requestedDifficulty: withChart ? values.requestedDifficulty : null,
    },
  });
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
