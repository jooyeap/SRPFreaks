import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type { NoticeResponse, PageResponse } from "@/lib/api-types";

/** 공지 쿼리 키. 보는 사람(viewerId)을 넣는 이유는 다른 화면과 같다(계정이 바뀌어도 이전 캐시가 보이지 않게). */
export const noticeKeys = {
  all: ["notices"] as const,
  list: (viewerId: number, page: number, size: number) => ["notices", "list", viewerId, page, size] as const,
};

export const NOTICES_PAGE_SIZE = 10;
// 서버(Notice 엔티티)와 같은 길이 제한이다. 서버도 다시 검사한다.
export const NOTICE_TITLE_MAX = 100;
export const NOTICE_CONTENT_MAX = 5000;

/** 공지 쓰기·고치기 폼 검증. 서버는 앞뒤 공백을 잘라 저장하므로 공백만 있는 값은 빈 값으로 본다. */
export const noticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해 주세요.")
    .max(NOTICE_TITLE_MAX, `제목은 ${NOTICE_TITLE_MAX}자 이하여야 합니다.`),
  content: z
    .string()
    .trim()
    .min(1, "내용을 입력해 주세요.")
    .max(NOTICE_CONTENT_MAX, `내용은 ${NOTICE_CONTENT_MAX}자 이하여야 합니다.`),
});
export type NoticeValues = z.infer<typeof noticeSchema>;

export function fetchNotices(page: number, size: number, signal?: AbortSignal): Promise<PageResponse<NoticeResponse>> {
  return apiFetch<PageResponse<NoticeResponse>>("/notices", { query: { page, size }, signal });
}

// 아래 셋은 ADMIN·ROOT만 부를 수 있다. 권한은 서버가 검사하고, 화면은 버튼을 보일지만 정한다.
export function createNotice(values: NoticeValues): Promise<NoticeResponse> {
  return apiFetch<NoticeResponse>("/admin/notices", { method: "POST", body: values });
}

export function updateNotice(noticeId: number, values: NoticeValues): Promise<NoticeResponse> {
  return apiFetch<NoticeResponse>(`/admin/notices/${noticeId}`, { method: "PUT", body: values });
}

export function deleteNotice(noticeId: number): Promise<void> {
  return apiFetch<void>(`/admin/notices/${noticeId}`, { method: "DELETE" });
}
