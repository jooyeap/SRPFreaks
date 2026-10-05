import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError, refreshSession, setAuthLostHandler } from "@/lib/api";
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
    user: { id: 1, email: "me@example.com", nickname: null, role: "USER", createdAt: "2026-10-05T00:00:00Z" },
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
