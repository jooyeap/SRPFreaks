import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES, type Locale } from "@/i18n/config";
import { jaT } from "@/i18n/ja-translator";
import { koT } from "@/i18n/ko-translator";
import type { Translator } from "@/i18n/translator";
import { bookmarkletMessages, buildLoaderFileSource } from "@/lib/import-bookmarklet";
import { buildLoaderStub, LOADER_FAILED_ALERT, loaderPath, LOADER_MANIFEST, type LoaderManifest } from "@/lib/import-loader";

/**
 * 가져오기 로더(D47) 검사.
 *  1) 매니페스트의 모든 버전 파일이 있고 해시가 맞다 → 이미 배포한 버전은 바뀌지 않는다(바꾸면 복사해 둔 스텁이 실행을 거부당한다).
 *  2) 최신 버전 파일이 현재 소스·문구와 같다 → 코드나 문구를 고쳤는데 새 버전을 안 만들면 여기서 실패한다.
 *  3) 스텁과 파일을 실제로 실행해 본다.
 * 새 버전 만들기: `UPDATE_IMPORT_LOADER=1 npx vitest run src/lib/import-loader.test.ts` (옛 버전 파일은 그대로 두고 v{n+1}을 추가한다)
 */
const TRANSLATORS: Record<Locale, Translator> = { ko: koT, ja: jaT };
const PUBLIC_DIR = path.join(process.cwd(), "public", "import-loader");
const MANIFEST_FILE = path.join(process.cwd(), "src", "lib", "import-loader-manifest.json");

const sri = (content: string) => `sha384-${createHash("sha384").update(content, "utf8").digest("base64")}`;
const fileOf = (version: string, locale: Locale) => path.join(PUBLIC_DIR, path.basename(loaderPath(version, locale)));
const expectedSource = (locale: Locale) => buildLoaderFileSource(bookmarkletMessages(TRANSLATORS[locale]));

if (process.env.UPDATE_IMPORT_LOADER === "1") {
  // 생성 모드: 최신 버전이 현재 소스와 다르면 새 버전을 추가한다
  const current = JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as LoaderManifest;
  const latest = current.versions[current.latest];
  const upToDate = latest !== undefined && LOCALES.every((l) => existsSync(fileOf(current.latest, l)) && sri(expectedSource(l)) === latest[l]);
  if (!upToDate) {
    const n = Object.keys(current.versions).length + 1;
    const version = `v${n}`;
    mkdirSync(PUBLIC_DIR, { recursive: true });
    const hashes = {} as Record<Locale, string>;
    for (const l of LOCALES) {
      const source = expectedSource(l);
      writeFileSync(fileOf(version, l), source, "utf8");
      hashes[l] = sri(source);
    }
    const next: LoaderManifest = { latest: version, versions: { ...current.versions, [version]: hashes } };
    writeFileSync(MANIFEST_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`로더 새 버전 ${version}을(를) 만들었습니다. 매니페스트와 public/import-loader를 커밋하세요.`);
  }
}

describe("가져오기 로더 파일과 해시(SRI)", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) as LoaderManifest;

  it("매니페스트에 있는 모든 버전·언어의 파일이 있고 해시가 맞다(배포한 버전은 바꾸지 않는다)", () => {
    expect(Object.keys(manifest.versions).length).toBeGreaterThan(0);
    for (const [version, hashes] of Object.entries(manifest.versions)) {
      for (const locale of LOCALES) {
        const file = fileOf(version, locale);
        expect(existsSync(file), `${version}/${locale} 파일이 없습니다`).toBe(true);
        expect(sri(readFileSync(file, "utf8")), `${version}/${locale} 해시가 다릅니다. 배포한 버전 파일은 고치지 않습니다`).toBe(hashes[locale]);
      }
    }
  });

  it("최신 버전은 매니페스트에 있고, 현재 소스·문구로 만든 파일과 같다(고쳤다면 새 버전을 만든다)", () => {
    expect(manifest.versions[manifest.latest]).toBeDefined();
    for (const locale of LOCALES) {
      const onDisk = readFileSync(fileOf(manifest.latest, locale), "utf8");
      expect(onDisk, `소스나 문구가 바뀌었습니다. UPDATE_IMPORT_LOADER=1 npx vitest run src/lib/import-loader.test.ts 로 새 버전을 만드세요`).toBe(expectedSource(locale));
    }
  });

  it("앱이 읽는 매니페스트와 파일 위치가 같다", () => {
    expect(LOADER_MANIFEST).toEqual(manifest);
  });

  it("파일 안에는 사이트 주소가 굳어 있지 않고 불러온 주소(currentScript)에서 읽는다", () => {
    const source = readFileSync(fileOf(manifest.latest, "ko"), "utf8");
    expect(source).not.toContain("srpfreaks.com");
    expect(source).toContain("document.currentScript");
  });
});

describe("스텁(주소창에 붙이는 한 줄)", () => {
  const SITE = "https://srpfreaks.com";

  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("짧다(예전 스크립트는 약 1만 자였다)", () => {
    for (const locale of LOCALES) {
      const stub = buildLoaderStub(SITE, locale);
      expect(stub.length).toBeLessThan(700);
    }
  });

  it("버전 파일 주소·해시·crossorigin을 단 script를 붙인다", () => {
    const stub = buildLoaderStub(SITE, "ko");
    new Function("document", stub)(document);
    // 스텁은 프로퍼티(s.integrity, s.crossOrigin)로 설정한다. 실제 브라우저는 이를 속성으로 반영한다(공식 사이트에서 확인했다).
    // jsdom은 integrity를 속성으로 반영하지 않아서 프로퍼티 값으로 확인한다.
    const script = document.querySelector("script") as HTMLScriptElement;
    expect(script.getAttribute("src")).toBe(`${SITE}${loaderPath(LOADER_MANIFEST.latest, "ko")}`);
    expect(script.integrity).toBe(LOADER_MANIFEST.versions[LOADER_MANIFEST.latest]?.ko);
    expect(script.crossOrigin).toBe("anonymous");
  });

  it("끝의 슬래시는 정리하고, 일본어는 일본어 파일을 가리킨다", () => {
    const stub = buildLoaderStub(`${SITE}/`, "ja");
    expect(stub).toContain(`'${SITE}${loaderPath(LOADER_MANIFEST.latest, "ja")}'`);
  });

  it("불러오기에 실패하면 영문 알림을 띄운다", () => {
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    new Function("document", "alert", buildLoaderStub(SITE, "ko"))(document, alertMock);
    const script = document.querySelector("script");
    (script as unknown as { onerror: () => void }).onerror();
    expect(alertMock).toHaveBeenCalledWith(LOADER_FAILED_ALERT);
  });

  it("스텁에는 한글·일본어 글자가 없다(복사한 값을 오류 메시지로 오해하지 않게)", () => {
    for (const locale of LOCALES) {
      // 한글(가-힣, 자모), 히라가나·가타카나, 한자
      expect(buildLoaderStub(SITE, locale)).not.toMatch(/[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF]/);
    }
  });
});

describe("불러온 파일 실행", () => {
  const SITE = "https://srp.example.com";
  const PATH = "/game/gfdm/gitadora_galaxywave_delta/p/playdata/stage_result.html";
  const openMock = vi.fn();
  const source = () => readFileSync(fileOf(LOADER_MANIFEST.latest, "ko"), "utf8");

  const play = `<div class="sr_list_tb">
    <table class="sr_data_music_info_tb"><tbody><tr><td><div class="title">Stargazer</div></td></tr></tbody></table>
    <table class="sr_data_score_tb"><tbody>
      <tr><th class="score_data">1</th><td rowspan="2" class="score_data_diff bass_mst">9.50</td></tr>
      <tr><td class="score_data">1</td></tr><tr><td class="score_data">1</td></tr><tr><td class="score_data">1</td></tr>
      <tr><td class="score_title">OK</td><td class="score_data">12</td></tr>
      <tr><td class="score_title">MISS</td><td class="score_data">110</td></tr>
      <tr><th class="score_data">73.87%</th></tr>
    </tbody></table>
    <form><input type="hidden" name="gtype" value="gf"><input type="hidden" name="date_ms" value="1791796344469"></form>
  </div>`;

  function runWith(location: { hostname: string; pathname: string; search: string }) {
    // 실제 환경처럼 document.currentScript가 이 파일을 불러온 script를 가리키게 한다
    Object.defineProperty(document, "currentScript", { value: { src: `${SITE}${loaderPath(LOADER_MANIFEST.latest, "ko")}` }, configurable: true });
    const win = { open: openMock, fetch: undefined, DOMParser: undefined };
    new Function("document", "location", "window", source())(document, location, win);
  }

  beforeEach(() => {
    openMock.mockReset();
    openMock.mockReturnValue({});
    document.body.innerHTML = "";
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "currentScript");
    document.body.innerHTML = "";
  });

  it("공식 페이지가 아니면 안내 창을 띄운다", () => {
    runWith({ hostname: "example.com", pathname: "/", search: "" });
    expect(document.getElementById("srp-import-modal")?.textContent).toContain("stage_result");
    expect(openMock).not.toHaveBeenCalled();
  });

  it("읽은 값을 파일을 불러온 사이트의 /import#srp= 로 보낸다(주소가 파일에 굳어 있지 않다)", () => {
    document.body.innerHTML = play;
    runWith({ hostname: "p.eagate.573.jp", pathname: PATH, search: "?page=1" });
    const [url, name] = openMock.mock.calls[0] as [string, string];
    expect(name).toBe("srpfreaks-import");
    expect(url.startsWith(`${SITE}/import#srp=`)).toBe(true);
    const payload = JSON.parse(decodeURIComponent(url.slice(`${SITE}/import#srp=`.length))) as { plays: { title: string }[] };
    expect(payload.plays.map((p) => p.title)).toEqual(["Stargazer"]);
  });
});
