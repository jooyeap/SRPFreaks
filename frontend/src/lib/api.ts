import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-token";
import type { ApiErrorBody, AuthResponse } from "@/lib/api-types";

/** 모든 API는 /api/v1 아래에 있다. 같은 도메인으로 요청하므로(개발 중에는 Next rewrite) CORS가 필요 없다. */
export const API_BASE = "/api/v1";

/** 서버가 준 문구가 없을 때 쓰는 일반 안내 (서버 내부 내용은 화면에 보여 주지 않는다). */
const GENERIC_ERROR_MESSAGE = "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.";
const NETWORK_ERROR_MESSAGE = "네트워크 연결을 확인해 주세요.";

/**
 * API 오류. code는 서버의 ErrorCode 이름(NOT_FOUND, VALIDATION_ERROR ...)이고,
 * 네트워크 자체가 끊긴 경우에는 status 0, code "NETWORK_ERROR"를 쓴다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string> | null;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON으로 보낼 값 */
  body?: unknown;
  /** 쿼리 문자열. null/undefined인 값은 보내지 않는다 */
  query?: Record<string, QueryValue>;
  /** false이면 토큰을 붙이지 않고 401이어도 재발급을 시도하지 않는다 (로그인 요청용) */
  auth?: boolean;
  signal?: AbortSignal;
}

// ---- 재발급 -------------------------------------------------------------------------------

let refreshInFlight: Promise<RefreshOutcome> | null = null;
let authLostHandler: (() => void) | null = null;

/** 재발급까지 실패해 로그인이 풀렸을 때 호출될 함수를 등록한다 (로그인 상태를 화면에 반영하려고). */
export function setAuthLostHandler(handler: (() => void) | null): void {
  authLostHandler = handler;
}

/**
 * 재발급 결과. 실패를 둘로 나누는 이유: "서버가 이 쿠키는 안 된다고 했다(401)"와 "지금은 확인할 수 없다(네트워크 끊김, 5xx, 429, 403 등)"는
 * 뜻이 다르다. 앞의 경우만 정말 로그인이 풀린 것이고, 뒤의 경우는 잠깐의 문제이므로 로그인 상태를 지우면 안 된다.
 */
export type RefreshOutcome =
  | { kind: "ok"; auth: AuthResponse }
  | { kind: "rejected" }
  | { kind: "unavailable" };

/**
 * Refresh 쿠키로 새 Access 토큰을 받는다. 성공하면 메모리에 저장하고 응답을 돌려주고, 실패하면 null.
 * 실패 종류까지 필요하면 refreshSessionOutcome을 쓴다.
 *
 * "한 번에 하나만" 실행한다(single-flight). 화면이 열릴 때 요청 여러 개가 동시에 401을 받으면
 * 재발급도 여러 번 나가게 되는데, 서버는 Refresh 토큰을 한 번 쓰면 폐기(Rotation)하고 재사용을 탐지하므로
 * 두 번째 요청이 "재사용"으로 오인되어 로그인이 풀린다. 그래서 진행 중인 요청 하나를 모두가 같이 기다린다.
 */
export async function refreshSession(): Promise<AuthResponse | null> {
  const outcome = await refreshSessionOutcome();
  return outcome.kind === "ok" ? outcome.auth : null;
}

export function refreshSessionOutcome(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<RefreshOutcome> {
  try {
    // Refresh 쿠키는 이 경로에만 실린다(Path=/api/v1/auth). 일반 apiFetch를 쓰면 401 -> 재발급이 무한 반복되므로 직접 호출한다.
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (response.status === 401) {
      return { kind: "rejected" };
    }
    if (!response.ok) {
      return { kind: "unavailable" };
    }
    const data = (await response.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    return { kind: "ok", auth: data };
  } catch {
    return { kind: "unavailable" };
  }
}

// ---- 요청 ---------------------------------------------------------------------------------

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE}${path}`;
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

async function send(path: string, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers();
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body,
      signal: options.signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error; // 화면을 떠나며 취소한 요청은 오류로 취급하지 않는다
    }
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
}

/** 오류 응답을 ApiError로 바꾼다. 본문이 우리 형식이 아니면 내용을 보여 주지 않고 일반 문구를 쓴다. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body.code === "string" && typeof body.message === "string") {
      return new ApiError(response.status, body.code, body.message, body.fieldErrors ?? null);
    }
  } catch {
    // JSON이 아닌 응답(프록시 오류 페이지 등)
  }
  return new ApiError(response.status, "UNKNOWN_ERROR", GENERIC_ERROR_MESSAGE);
}

/**
 * API 호출. 성공하면 JSON을 T 타입으로 돌려주고(204면 undefined), 실패하면 ApiError를 던진다.
 *
 * 401을 받으면: Refresh 쿠키로 재발급 -> 성공하면 같은 요청을 딱 한 번 다시 보낸다.
 * 서버가 재발급을 거부하면(로그인이 풀림) 토큰을 지우고 등록된 핸들러를 부른 뒤 ApiError를 던진다.
 * 재발급이 일시적으로 안 되면(네트워크, 5xx, 429 등) 로그인 상태는 그대로 두고 ApiError만 던진다.
 * 응답 JSON은 서버를 믿고 T로 취급한다(as T). 이후 필요한 곳에서 Zod로 검증을 더할 수 있다.
 */
export async function apiFetch<T = void>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshSessionOutcome();
    if (refreshed.kind === "ok") {
      response = await send(path, options); // 새 토큰으로 한 번만 재시도 (무한 반복 방지)
    }
    // 서버가 거부했거나(401) 새 토큰으로도 401일 때만 로그인이 풀린 것으로 본다.
    // 일시적인 문제(unavailable)에는 로그인 상태를 지우지 않고 원래 오류만 던진다. 쿠키는 아직 유효할 수 있다.
    if (response.status === 401 && refreshed.kind !== "unavailable") {
      clearAccessToken();
      authLostHandler?.();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
