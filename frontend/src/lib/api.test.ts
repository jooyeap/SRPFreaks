import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import { setClientTranslator } from "@/i18n/client-messages";
import type { Translator } from "@/i18n/translator";
import ja from "../../messages/ja.json";
import { apiFetch, ApiError, refreshSession, refreshSessionOutcome, refreshSessionWithRetry, setAuthLostHandler } from "@/lib/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth-token";
import type { AuthResponse } from "@/lib/api-types";

/** fetch를 가짜로 바꿔서 서버 없이 요청/응답을 확인한다. */
const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function authResponse(token: string): AuthResponse {
  return {
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: 900,
    user: { id: 1, email: "me@example.com", nickname: null, role: "USER", profilePublic: false, rivalNotify: true, createdAt: "2026-10-05T00:00:00Z" },
  };
}

/** 호출된 fetch의 n번째 요청 정보를 꺼낸다. */
function call(n: number) {
  const [url, init] = fetchMock.mock.calls[n];
  return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearAccessToken();
  setAuthLostHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("요청 만들기", () => {
  it("토큰이 있으면 Authorization: Bearer를 붙인다", async () => {
    setAccessToken("abc");
    fetchMock.mockResolvedValue(json({ ok: true }));

    await apiFetch("/users/me");

    expect(call(0).url).toBe("/api/v1/users/me");
    expect(call(0).headers.get("Authorization")).toBe("Bearer abc");
  });

  it("FormData는 JSON으로 바꾸지 않고 그대로 보내며 Content-Type은 브라우저에 맡긴다(사진 인식)", async () => {
    fetchMock.mockResolvedValue(json({}));
    const form = new FormData();
    form.append("image", new Blob(["x"], { type: "image/jpeg" }), "photo.jpg");

    await apiFetch("/records/recognize", { method: "POST", body: form });

    expect(call(0).init.body).toBe(form);
    expect(call(0).headers.has("Content-Type")).toBe(false);
  });

  it("토큰이 없으면 Authorization을 붙이지 않는다", async () => {
    fetchMock.mockResolvedValue(json({}));

    await apiFetch("/songs");

    expect(call(0).headers.has("Authorization")).toBe(false);
  });

  it("auth: false이면 토큰이 있어도 붙이지 않는다 (로그인 요청)", async () => {
    setAccessToken("abc");
    fetchMock.mockResolvedValue(json({}));

    await apiFetch("/auth/google", { method: "POST", body: { idToken: "x" }, auth: false });

    expect(call(0).headers.has("Authorization")).toBe(false);
  });

  it("쿼리 문자열을 만들고 null/undefined 값은 뺀다", async () => {
    fetchMock.mockResolvedValue(json({}));

    await apiFetch("/songs", { query: { q: "네크로 판타지", page: 0, size: 20, sort: undefined, part: null } });

    const url = call(0).url;
    expect(url).toBe("/api/v1/songs?q=%EB%84%A4%ED%81%AC%EB%A1%9C+%ED%8C%90%ED%83%80%EC%A7%80&page=0&size=20");
  });

  it("body는 JSON으로 보내고 Content-Type을 붙인다", async () => {
    fetchMock.mockResolvedValue(json({}, 201));

    await apiFetch("/records", { method: "POST", body: { achievementRate: 95.5 } });

    expect(call(0).init.method).toBe("POST");
    expect(call(0).init.body).toBe('{"achievementRate":95.5}');
    expect(call(0).headers.get("Content-Type")).toBe("application/json");
  });
});

describe("응답 처리", () => {
  it("성공하면 JSON을 돌려준다", async () => {
    fetchMock.mockResolvedValue(json({ id: 7 }));

    await expect(apiFetch<{ id: number }>("/records/7")).resolves.toEqual({ id: 7 });
  });

  it("204이면 undefined를 돌려준다", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch("/records/7", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("오류 응답을 ApiError(코드, 메시지, 필드 오류)로 바꾼다", async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          code: "VALIDATION_ERROR",
          message: "요청 값을 확인해 주세요.",
          timestamp: "2026-10-05T00:00:00Z",
          fieldErrors: { achievementRate: "달성률은 필수입니다." },
        },
        400,
      ),
    );

    const error = await apiFetch("/records", { method: "POST", body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.message).toBe("요청 값을 확인해 주세요.");
    expect(apiError.fieldErrors).toEqual({ achievementRate: "달성률은 필수입니다." });
  });

  it("JSON이 아닌 오류 본문은 화면에 노출하지 않고 일반 문구를 쓴다", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway at 10.0.0.5</html>", { status: 502 }));

    const error = (await apiFetch("/songs").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");
    expect(error.message).not.toContain("10.0.0.5");
  });

  it("네트워크가 끊기면 NETWORK_ERROR로 바꾼다", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = (await apiFetch("/songs").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("네트워크 연결을 확인해 주세요.");
  });

  it("취소한 요청(AbortError)은 ApiError로 바꾸지 않는다", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    const error = await apiFetch("/songs").catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe("AbortError");
  });
});

describe("401 -> 재발급 -> 재시도", () => {
  it("401이면 재발급하고 새 토큰으로 같은 요청을 한 번 다시 보낸다", async () => {
    setAccessToken("old");
    fetchMock
      .mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401)) // 원래 요청
      .mockResolvedValueOnce(json(authResponse("new"))) // 재발급
      .mockResolvedValueOnce(json({ ok: true })); // 재시도

    await expect(apiFetch<{ ok: boolean }>("/users/me")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(call(1).url).toBe("/api/v1/auth/refresh");
    expect(call(1).init.method).toBe("POST");
    expect(call(1).init.credentials).toBe("include"); // Refresh 쿠키를 싣는다
    expect(call(2).headers.get("Authorization")).toBe("Bearer new");
    expect(getAccessToken()).toBe("new");
  });

  it("재발급이 실패하면 토큰을 지우고 핸들러를 부르고 ApiError를 던진다", async () => {
    setAccessToken("old");
    const lost = vi.fn();
    setAuthLostHandler(lost);
    fetchMock
      .mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401))
      .mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "로그인할 수 없습니다. 다시 로그인해 주세요." }, 401));

    const error = (await apiFetch("/users/me").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 원래 요청 + 재발급. 재시도는 하지 않는다
  });

  it("재발급이 일시적으로 안 되면(5xx, 429, 403, 네트워크) 로그인 상태를 지우지 않고 원래 오류만 던진다", async () => {
    const unauthorized = () => json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401);
    const cases: Array<() => Promise<Response>> = [
      () => Promise.resolve(json({ code: "INTERNAL_ERROR", message: "x" }, 500)),
      () => Promise.resolve(json({ code: "TOO_MANY_REQUESTS", message: "x" }, 429)),
      () => Promise.resolve(json({ code: "ORIGIN_NOT_ALLOWED", message: "x" }, 403)),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ];
    for (const refreshResult of cases) {
      fetchMock.mockReset();
      setAccessToken("old");
      const lost = vi.fn();
      setAuthLostHandler(lost);
      fetchMock.mockResolvedValueOnce(unauthorized()).mockImplementationOnce(refreshResult);

      const error = (await apiFetch("/users/me").catch((e: unknown) => e)) as ApiError;

      expect(error.status).toBe(401);
      expect(getAccessToken()).toBe("old"); // 쿠키가 아직 유효할 수 있으니 지우지 않는다
      expect(lost).not.toHaveBeenCalled();
    }
  });

  it("재시도도 401이면 더 반복하지 않는다 (무한 반복 방지)", async () => {
    setAccessToken("old");
    const unauthorized = () => json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401);
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(json(authResponse("new")))
      .mockResolvedValueOnce(unauthorized());

    await expect(apiFetch("/users/me")).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("동시에 여러 요청이 401을 받아도 재발급은 한 번만 한다", async () => {
    setAccessToken("old");
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return json(authResponse("new"));
      }
      return getAccessToken() === "new" ? json({ ok: true }) : json({ code: "UNAUTHORIZED", message: "x" }, 401);
    });

    const results = await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);

    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it("auth: false 요청은 401이어도 재발급을 시도하지 않는다", async () => {
    fetchMock.mockResolvedValue(json({ code: "AUTH_FAILED", message: "로그인할 수 없습니다. 다시 로그인해 주세요." }, 401));

    const error = (await apiFetch("/auth/google", { method: "POST", body: {}, auth: false }).catch(
      (e: unknown) => e,
    )) as ApiError;

    expect(error.code).toBe("AUTH_FAILED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/** exp(초)만 담은 JWT 모양 문자열 (서명은 검증하지 않는 쪽에서만 읽는다) */
function tokenExpiringAt(expMs: number): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ exp: Math.floor(expMs / 1000) })}.sig`;
}

describe("만료된 토큰은 보내기 전에 재발급", () => {
  it("만료된 토큰이면 요청 전에 재발급하고 새 토큰으로 보낸다 (공개 경로가 401을 주지 않는 경우)", async () => {
    setAccessToken(tokenExpiringAt(Date.now() - 60_000));
    fetchMock
      .mockResolvedValueOnce(json(authResponse("fresh"))) // 재발급
      .mockResolvedValueOnce(json({ ok: true })); // 원래 요청

    await expect(apiFetch<{ ok: boolean }>("/songs")).resolves.toEqual({ ok: true });

    expect(call(0).url).toBe("/api/v1/auth/refresh");
    expect(call(1).url).toBe("/api/v1/songs");
    expect(call(1).headers.get("Authorization")).toBe("Bearer fresh");
  });

  it("30초 안에 만료될 토큰도 먼저 재발급한다", async () => {
    setAccessToken(tokenExpiringAt(Date.now() + 10_000));
    fetchMock.mockResolvedValueOnce(json(authResponse("fresh"))).mockResolvedValueOnce(json({}));

    await apiFetch("/songs");

    expect(call(0).url).toBe("/api/v1/auth/refresh");
  });

  it("아직 여유가 있으면 재발급하지 않는다", async () => {
    const token = tokenExpiringAt(Date.now() + 10 * 60_000);
    setAccessToken(token);
    fetchMock.mockResolvedValue(json({}));

    await apiFetch("/songs");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call(0).headers.get("Authorization")).toBe(`Bearer ${token}`);
  });

  it("읽을 수 없는 토큰이나 토큰 없음은 재발급하지 않는다 (서버 판단에 맡긴다)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({})));
    await apiFetch("/songs");
    setAccessToken("not-a-jwt");
    await apiFetch("/songs");
    setAccessToken("a.%%%.c");
    await apiFetch("/songs");
    expect(fetchMock.mock.calls.every(([url]) => String(url) === "/api/v1/songs")).toBe(true);
  });

  it("서버가 재발급을 거부하면 로그인이 풀린 것으로 처리하고 토큰 없이 보낸다", async () => {
    setAccessToken(tokenExpiringAt(Date.now() - 1000));
    const lost = vi.fn();
    setAuthLostHandler(lost);
    fetchMock
      .mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401))
      .mockResolvedValueOnce(json({}));

    await apiFetch("/songs");

    expect(lost).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(call(1).headers.has("Authorization")).toBe(false);
  });

  it("재발급이 일시적으로 안 되면 로그인 상태를 지우지 않고 원래 요청을 보낸다", async () => {
    const token = tokenExpiringAt(Date.now() - 1000);
    setAccessToken(token);
    const lost = vi.fn();
    setAuthLostHandler(lost);
    fetchMock.mockResolvedValueOnce(json({ code: "INTERNAL_ERROR", message: "x" }, 500)).mockResolvedValueOnce(json({}));

    await apiFetch("/songs");

    expect(lost).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe(token);
  });

  it("동시에 여러 요청이 와도 재발급은 한 번만 한다", async () => {
    setAccessToken(tokenExpiringAt(Date.now() - 1000));
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).endsWith("/auth/refresh") ? json(authResponse("fresh")) : json({})),
    );

    await Promise.all([apiFetch("/songs"), apiFetch("/difficulty-tables"), apiFetch("/users/me")]);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("auth: false 요청은 만료된 토큰이 있어도 재발급하지 않는다", async () => {
    setAccessToken(tokenExpiringAt(Date.now() - 1000));
    fetchMock.mockResolvedValue(json({}));

    await apiFetch("/auth/google", { method: "POST", auth: false, body: {} });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("refreshSession", () => {
  it("성공하면 토큰을 메모리에 저장하고 응답을 돌려준다", async () => {
    fetchMock.mockResolvedValue(json(authResponse("fresh")));

    const result = await refreshSession();

    expect(result?.user.email).toBe("me@example.com");
    expect(getAccessToken()).toBe("fresh");
  });

  it("서버가 거부하거나 네트워크가 끊기면 null이다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401));
    expect(await refreshSession()).toBeNull();

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await refreshSession()).toBeNull();
  });
});

describe("refreshSessionOutcome", () => {
  it("401은 rejected, 그 밖의 실패와 네트워크 오류는 unavailable로 구분한다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "AUTH_FAILED", message: "x" }, 401));
    expect(await refreshSessionOutcome()).toEqual({ kind: "rejected" });

    for (const status of [403, 429, 500]) {
      fetchMock.mockResolvedValueOnce(json({ code: "X", message: "x" }, status));
      expect(await refreshSessionOutcome()).toEqual({ kind: "unavailable" });
    }

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await refreshSessionOutcome()).toEqual({ kind: "unavailable" });
  });

  it("성공하면 ok와 응답을 돌려준다", async () => {
    fetchMock.mockResolvedValue(json(authResponse("fresh")));
    const outcome = await refreshSessionOutcome();
    expect(outcome.kind).toBe("ok");
  });
});

describe("refreshSessionWithRetry", () => {
  const unavailable = () => json({ code: "X", message: "x" }, 503);

  it("일시 오류(unavailable)면 간격을 두고 다시 시도해서 성공하면 ok를 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(unavailable()).mockResolvedValueOnce(unavailable()).mockResolvedValueOnce(json(authResponse("fresh")));
    const outcome = await refreshSessionWithRetry(() => false, [0, 0]);
    expect(outcome.kind).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("계속 일시 오류면 정해진 횟수만 시도하고 unavailable을 돌려준다", async () => {
    fetchMock.mockResolvedValue(unavailable());
    expect(await refreshSessionWithRetry(() => false, [0, 0])).toEqual({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 처음 1번 + 재시도 2번
  });

  it("서버가 401로 거절(rejected)하면 다시 시도하지 않는다 (진짜로 로그인이 풀린 것)", async () => {
    fetchMock.mockResolvedValue(json({ code: "AUTH_FAILED", message: "x" }, 401));
    expect(await refreshSessionWithRetry(() => false, [0, 0])).toEqual({ kind: "rejected" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("화면이 사라졌으면(취소) 기다린 뒤 더 시도하지 않는다", async () => {
    fetchMock.mockResolvedValue(unavailable());
    let cancelled = false;
    const promise = refreshSessionWithRetry(() => cancelled, [0, 0]);
    cancelled = true;
    expect(await promise).toEqual({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("탭 사이 재발급 잠금 (Web Locks)", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("브라우저가 지원하면 재발급을 잠금 안에서 한다 (탭 두 개가 같은 쿠키로 동시에 요청하지 않게)", async () => {
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback());
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
    fetchMock.mockResolvedValue(json(authResponse("fresh")));

    const outcome = await refreshSessionOutcome();

    expect(outcome.kind).toBe("ok");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("srpfreaks-refresh");
  });

  it("지원하지 않는 브라우저에서는 잠금 없이 바로 요청한다", async () => {
    fetchMock.mockResolvedValue(json(authResponse("fresh")));
    expect((await refreshSessionOutcome()).kind).toBe("ok");
  });
});

describe("토큰 보관 (보안)", () => {
  it("토큰을 localStorage/sessionStorage에 저장하지 않는다", async () => {
    fetchMock.mockResolvedValue(json(authResponse("secret-token")));

    await refreshSession();
    setAccessToken("another-secret");

    expect(getAccessToken()).toBe("another-secret");
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("secret");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("느린 망 대비", () => {
  it("조회(GET)는 시간 제한 신호를 붙이고, 쓰기는 붙이지 않는다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({}))); // 호출마다 새 Response (본문은 한 번만 읽을 수 있다)
    await apiFetch("/songs");
    await apiFetch("/records", { method: "POST", body: {} });
    expect(call(0).init.signal).toBeInstanceOf(AbortSignal);
    expect(call(1).init.signal).toBeUndefined();
  });

  it("시간이 지나 끊긴 조회는 '응답이 늦어지고 있습니다' 오류(TIMEOUT)로 바꾼다", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    await expect(apiFetch("/songs")).rejects.toMatchObject({ status: 0, code: "TIMEOUT", message: expect.stringContaining("늦어지고") });
  });

  it("화면을 떠나며 취소한 요청(AbortError)은 오류로 바꾸지 않고 그대로 던진다", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(apiFetch("/songs")).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("오류 문구 번역", () => {
  const jaT = createTranslator({ locale: "ja", messages: ja } as never) as Translator;
  afterEach(() => setClientTranslator(null));

  it("서버의 고정 문구는 현재 언어로 바꿔 보여 준다", async () => {
    setClientTranslator(jaT);
    fetchMock.mockResolvedValueOnce(json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404));
    await expect(apiFetch("/songs/1")).rejects.toMatchObject({ code: "NOT_FOUND", message: "見つかりません。" });
  });

  it("서비스가 직접 쓴 문구는 그대로 둔다", async () => {
    setClientTranslator(jaT);
    fetchMock.mockResolvedValueOnce(json({ code: "CONFLICT", message: "이미 사용 중인 닉네임입니다.", timestamp: "t" }, 409));
    await expect(apiFetch("/users/me/nickname")).rejects.toMatchObject({ message: "이미 사용 중인 닉네임입니다." });
  });

  it("네트워크 오류도 현재 언어로, 번역기가 없으면 한국어 기본 문구", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fail"));
    await expect(apiFetch("/songs")).rejects.toMatchObject({ message: "네트워크 연결을 확인해 주세요." });
    setClientTranslator(jaT);
    fetchMock.mockRejectedValueOnce(new TypeError("fail"));
    await expect(apiFetch("/songs")).rejects.toMatchObject({ message: "ネットワーク接続を確認してください。" });
  });
});
