import { ApiError } from "@/lib/api";

/**
 * 조회(useQuery)를 자동으로 다시 시도하는 규칙. 쓰기(useMutation)에는 쓰지 않는다(두 번 저장될 수 있다).
 *
 *  - 4xx(없는 곡, 권한 없음 등): 다시 보내도 같은 답이라 바로 실패로 보여 준다.
 *  - 502·503·504(배포로 서버가 다시 뜨는 중, 2026-10-28): 서버가 다시 켜지는 데 약 30초가 걸리므로
 *    3초·6초·9초·12초 간격으로 4번까지(합계 약 30초) 다시 시도한다. 그동안 화면은 오류 대신 불러오는 중으로 보인다.
 *  - 그 밖(네트워크·시간 초과·500 등): 지금처럼 두 번까지, TanStack Query 기본 간격(1초, 2초…)으로.
 */
export const GATEWAY_RETRY_LIMIT = 4;
const GATEWAY_RETRY_STEP_MS = 3_000;
const DEFAULT_RETRY_LIMIT = 2;

function isGatewayError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 502 || error.status === 503 || error.status === 504);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < (isGatewayError(error) ? GATEWAY_RETRY_LIMIT : DEFAULT_RETRY_LIMIT);
}

/** attemptIndex는 0부터(첫 재시도 = 0). TanStack Query 기본 간격은 min(1000 × 2^n, 30000)이다. */
export function queryRetryDelay(attemptIndex: number, error: unknown): number {
  if (isGatewayError(error)) {
    return GATEWAY_RETRY_STEP_MS * (attemptIndex + 1);
  }
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}
