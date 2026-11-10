// 배포 뒤 화면 확인(아이디어 5, 2026-11-01). 운영 사이트의 로그인 없이 보이는 화면을 360px·1280px로 열어
// (1) 응답이 200인지 (2) 화면에 오류 문구가 없는지 (3) 콘솔 오류가 없는지 보고, 사진을 screens/ 폴더에 남긴다.
// 일본어(ja) 360px에서는 (4) 가로 폭이 화면 폭을 넘지 않는지도 본다(2026-11-07, 홈 진행도 안내 줄이 넘쳐 모바일에서 페이지가 축소된 적이 있다).
// 로그인이 필요한 화면은 찍지 않는다(CI에 계정 정보를 넣지 않는다). 서버를 바꾸는 요청은 보내지 않는다(GET만).
// 사용: node scripts/deploy/screens.mjs https://srpfreaks.com   (playwright가 설치돼 있어야 한다)
import { mkdir, writeFile } from "node:fs/promises";

/** 화면 목록. songId가 있으면 곡 상세도 넣는다(서열표에서 들어간 화면이 아니라 일반 곡 상세). */
export function pagesFor(songId) {
  const pages = [
    { name: "home", path: "/" },
    { name: "table", path: "/table" },
    { name: "songs", path: "/songs" },
    { name: "notices", path: "/notices" },
    { name: "tier-changes", path: "/notices#tier-changes" },
  ];
  if (Number.isInteger(songId) && songId > 0) {
    pages.push({ name: "song-detail", path: `/songs/${songId}` });
  }
  return pages;
}

export const VIEWPORTS = [
  { name: "360", width: 360, height: 800 },
  { name: "1280", width: 1280, height: 900 },
  // 일본어는 띄어쓰기가 없어 한 줄이 길어지기 쉽다. 언어는 쿠키(srp.locale)로 고른다(frontend/src/i18n/config.ts)
  { name: "360-ja", width: 360, height: 800, locale: "ja" },
];

/** 언어를 저장하는 쿠키 이름(frontend/src/i18n/config.ts의 LOCALE_COOKIE와 같아야 한다) */
export const LOCALE_COOKIE = "srp.locale";

/**
 * 문서 가로 폭이 화면 폭을 넘는지. 서브픽셀 반올림 때문에 1px까지는 허용한다.
 * 넘치면 모바일 Chrome이 페이지를 축소해 보여 주고 오른쪽에 빈 띠가 생긴다.
 */
export function isHorizontalOverflow(scrollWidth, clientWidth, tolerance = 1) {
  return scrollWidth > clientWidth + tolerance;
}

export function overflowProblem(scrollWidth, clientWidth) {
  return isHorizontalOverflow(scrollWidth, clientWidth) ? `가로 폭 초과 (${scrollWidth}px > ${clientWidth}px)` : null;
}

/** 화면 글자에 이런 문구가 있으면 실패로 본다(우리 사이트의 공통 오류 문구). */
export const ERROR_TEXTS = ["불러오지 못했습니다", "문제가 생겼습니다", "Application error"];

export function findErrorText(text) {
  return ERROR_TEXTS.find((needle) => text.includes(needle)) ?? null;
}

/**
 * 화면 문제로 볼 콘솔 오류인지. 로그인하지 않은 방문이라 `/auth/refresh`·`/users/me` 같은 요청이 401로 끝나는 것은 정상이고,
 * 브라우저는 이를 "Failed to load resource" 콘솔 오류로 찍는다. 이런 네트워크 응답 줄은 세지 않는다(화면 오류가 아님).
 */
export function isRealConsoleError(text) {
  return !text.startsWith("Failed to load resource");
}

async function firstSongId(site) {
  try {
    const res = await fetch(`${site}/api/v1/songs?page=0&size=1`);
    if (!res.ok) return null;
    const body = await res.json();
    const first = body?.content?.[0];
    return typeof first?.songId === "number" ? first.songId : typeof first?.id === "number" ? first.id : null;
  } catch {
    return null;
  }
}

async function main() {
  const site = (process.argv[2] ?? "").replace(/\/$/, "");
  if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(site)) {
    console.error("사이트 주소는 https://도메인 형식이어야 합니다.");
    process.exit(2);
  }
  const { chromium } = await import("playwright");
  await mkdir("screens", { recursive: true });
  const browser = await chromium.launch();
  const songId = await firstSongId(site);
  const results = [];
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: "dark", locale: vp.locale === "ja" ? "ja-JP" : "ko-KR" });
    if (vp.locale) {
      await context.addCookies([{ name: LOCALE_COOKIE, value: vp.locale, url: site }]);
    }
    for (const page of pagesFor(songId)) {
      const tab = await context.newPage();
      const consoleErrors = [];
      tab.on("console", (msg) => {
        if (msg.type() === "error" && isRealConsoleError(msg.text())) consoleErrors.push(msg.text().slice(0, 200));
      });
      let status = 0;
      let problem = null;
      try {
        const res = await tab.goto(site + page.path, { waitUntil: "networkidle", timeout: 30000 });
        status = res?.status() ?? 0;
        await tab.waitForTimeout(1000);
        const text = await tab.locator("body").innerText();
        const found = findErrorText(text);
        if (status !== 200) problem = `응답 ${status}`;
        else if (found) problem = `오류 문구 "${found}"`;
        else if (consoleErrors.length > 0) problem = `콘솔 오류 ${consoleErrors.length}건`;
        else if (vp.locale) {
          const widths = await tab.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          problem = overflowProblem(widths.scroll, widths.client);
        }
        await tab.screenshot({ path: `screens/${vp.name}-${page.name}.png`, fullPage: false });
      } catch (error) {
        problem = `열지 못함: ${String(error).slice(0, 120)}`;
      }
      results.push({ viewport: vp.name, page: page.name, status, problem, consoleErrors });
      await tab.close();
    }
    await context.close();
  }
  await browser.close();
  await writeFile("screens/result.json", JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.problem);
  const lines = ["## 배포 후 화면 확인", "", "| 폭 | 화면 | 결과 |", "|---|---|---|"];
  for (const r of results) lines.push(`| ${r.viewport} | ${r.page} | ${r.problem ?? "정상"} |`);
  lines.push("", failed.length === 0 ? "모든 화면 정상. 사진은 실행 결과의 `screens` 묶음에 있다." : `문제 ${failed.length}건. 사진을 확인하세요.`);
  await writeFile("screens/summary.md", lines.join("\n") + "\n");
  // 실패한 화면은 GitHub 주석(annotation)으로도 남긴다. 실행 요약·사진 묶음을 못 여는 곳(API)에서도 이유를 읽을 수 있게.
  for (const r of failed) {
    const detail = r.consoleErrors.length > 0 ? ` · ${r.consoleErrors[0].replace(/[\r\n]+/g, " ")}` : "";
    console.log(`::error title=화면 확인 실패 (${r.viewport}px ${r.page})::${r.problem}${detail}`);
  }
  console.log(lines.join("\n"));
  process.exit(failed.length === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
