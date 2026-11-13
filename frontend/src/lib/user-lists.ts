import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type { Translator } from "@/i18n/translator";
import type {
  PageResponse,
  UserListAddItemResponse,
  UserListDetailResponse,
  UserListSummaryResponse,
} from "@/lib/api-types";

/**
 * 내 리스트 쿼리 키(D76). 앞부분 "lists"는 records.ts의 AFFECTED_QUERY_KEYS와 같다: 기록을 저장·수정·삭제하면 무효화되어 줄의 내 달성률이 바로 바뀐다.
 * 리스트는 본인만 보므로 사용자 id를 키에 넣는다(계정을 바꿔도 남의 캐시가 보이지 않게).
 */
export const listKeys = {
  all: ["lists"] as const,
  index: (userId: number, songDifficultyId: number | null) => ["lists", "index", userId, songDifficultyId] as const,
  detail: (userId: number, listId: number, page: number) => ["lists", "detail", userId, listId, page] as const,
};

/** 리스트 이름의 최대 글자 수(서버 UserListService와 같다). 개수·곡 수 한도(설정 list.max_*)는 화면에 박지 않고 서버가 검사해 문구를 돌려준다. */
export const LIST_NAME_MAX = 20;
/** 리스트 화면의 한 쪽 줄 수 */
export const LIST_PAGE_SIZE = 10;
/** 리스트 목록(색인)을 한 번에 받는 수. 한도(기본 10개)보다 넉넉하게 받아 한 화면에서 모두 본다. */
export const LIST_INDEX_SIZE = 100;
/** 리스트 상세의 한 쪽 줄 수(서버 상세 기본값과 같다). 곡 수 한도(기본 50)가 한 쪽에 들어와 순서 바꾸기가 쉽다. */
export const LIST_DETAIL_SIZE = 100;

export function fetchLists(songDifficultyId: number | null, signal?: AbortSignal): Promise<PageResponse<UserListSummaryResponse>> {
  return apiFetch<PageResponse<UserListSummaryResponse>>("/me/lists", {
    query: { page: 0, size: LIST_INDEX_SIZE, ...(songDifficultyId === null ? {} : { songDifficultyId }) },
    signal,
  });
}

export function createList(name: string): Promise<UserListSummaryResponse> {
  return apiFetch<UserListSummaryResponse>("/me/lists", { method: "POST", body: { name } });
}

export function renameList(listId: number, name: string): Promise<UserListSummaryResponse> {
  return apiFetch<UserListSummaryResponse>(`/me/lists/${listId}`, { method: "PATCH", body: { name } });
}

export function deleteList(listId: number): Promise<void> {
  return apiFetch<void>(`/me/lists/${listId}`, { method: "DELETE" });
}

export function fetchListDetail(listId: number, page: number, signal?: AbortSignal): Promise<UserListDetailResponse> {
  return apiFetch<UserListDetailResponse>(`/me/lists/${listId}`, { query: { page, size: LIST_DETAIL_SIZE }, signal });
}

export function addToList(listId: number, songDifficultyId: number): Promise<UserListAddItemResponse> {
  return apiFetch<UserListAddItemResponse>(`/me/lists/${listId}/items`, { method: "POST", body: { songDifficultyId } });
}

export function removeFromList(listId: number, songDifficultyId: number): Promise<void> {
  return apiFetch<void>(`/me/lists/${listId}/items/${songDifficultyId}`, { method: "DELETE" });
}

/** 순서를 바꾼다. 보내는 것은 채보 id(songDifficultyId) 전체를 원하는 순서로 늘어놓은 목록이다. */
export function reorderList(listId: number, songDifficultyIds: readonly number[]): Promise<void> {
  return apiFetch<void>(`/me/lists/${listId}/items/order`, { method: "PUT", body: { songDifficultyIds } });
}

/** 배열에서 `from` 칸의 값을 `to` 칸으로 옮긴 새 배열(위/아래 버튼용). 범위를 벗어나면 그대로 돌려준다. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

/**
 * 리스트 이름 입력 검사(Zod). 서버(UserListService.normalizeName)와 같은 규칙이다: 앞뒤 공백을 뗀 뒤 1~20자(글자 수는 코드포인트 기준).
 * 서버가 NFKC 정규화·같은 이름 검사·개수 한도를 다시 하므로 화면은 비었는지와 길이만 본다.
 */
export function makeListNameSchema(t: Translator) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("Validation.listNameRequired"))
      .refine((value) => [...value].length <= LIST_NAME_MAX, t("Validation.listNameMax", { max: LIST_NAME_MAX })),
  });
}

export type ListNameFormValues = z.infer<ReturnType<typeof makeListNameSchema>>;
