import type { MessageKey } from "@/i18n/translator";

/**
 * 서버(백엔드 ErrorCode)가 코드마다 고정해서 보내는 한국어 문구와, 그 문구의 번역 키.
 * 응답의 message가 이 한국어 문구와 정확히 같을 때만 번역으로 바꿔 보여 준다.
 * 서비스가 상황에 맞춰 직접 쓴 문구(예: 닉네임이 겹칩니다)는 서버 문구를 그대로 보여 준다 — 그 번역은 [I18N-GLOSSARY](docs/I18N-GLOSSARY.md)에 남겨 둔다.
 * 값이 `messages/ko.json`의 `ServerErrors`와 같은지는 테스트가 확인한다.
 */
export const SERVER_ERRORS: Record<string, { message: string; key: MessageKey }> = {
  AUTH_FAILED: { message: "로그인할 수 없습니다. 다시 로그인해 주세요.", key: "ServerErrors.AUTH_FAILED" },
  UNAUTHORIZED: { message: "로그인이 필요합니다.", key: "ServerErrors.UNAUTHORIZED" },
  FORBIDDEN: { message: "권한이 없습니다.", key: "ServerErrors.FORBIDDEN" },
  ORIGIN_NOT_ALLOWED: { message: "허용되지 않은 요청입니다.", key: "ServerErrors.ORIGIN_NOT_ALLOWED" },
  VALIDATION_ERROR: { message: "요청 값을 확인해 주세요.", key: "ServerErrors.VALIDATION_ERROR" },
  BAD_REQUEST: { message: "잘못된 요청입니다.", key: "ServerErrors.BAD_REQUEST" },
  NOT_FOUND: { message: "찾을 수 없습니다.", key: "ServerErrors.NOT_FOUND" },
  CONFLICT: { message: "이미 등록되어 있습니다.", key: "ServerErrors.CONFLICT" },
  SONG_TITLE_DUPLICATE: { message: "같은 이름의 곡이 이미 등록되어 있습니다. 곡 목록에서 확인해 주세요.", key: "ServerErrors.SONG_TITLE_DUPLICATE" },
  SNAPSHOT_ALREADY_TODAY: { message: "방금 기록했습니다. 잠시 후 다시 시도해 주세요.", key: "ServerErrors.SNAPSHOT_ALREADY_TODAY" },
  SNAPSHOT_NO_CHANGE: { message: "마지막 기록과 점수가 같아 기록할 수 없습니다.", key: "ServerErrors.SNAPSHOT_NO_CHANGE" },
  SNAPSHOT_NO_RECORDS: { message: "레이팅에 들어간 기록이 없어 기록할 수 없습니다.", key: "ServerErrors.SNAPSHOT_NO_RECORDS" },
  SUGGESTION_LIMIT: { message: "오늘은 건의를 더 보낼 수 없습니다. 내일 다시 보내 주세요.", key: "ServerErrors.SUGGESTION_LIMIT" },
  SETLIST_FULL: { message: "세트리스트에는 30곡까지 담을 수 있습니다.", key: "ServerErrors.SETLIST_FULL" },
  RATE_LIMITED: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", key: "ServerErrors.RATE_LIMITED" },
  INTERNAL_ERROR: { message: "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.", key: "ServerErrors.INTERNAL_ERROR" },
};
