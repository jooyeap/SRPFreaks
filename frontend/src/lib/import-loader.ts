/**
 * 가져오기 스크립트 로더(D47).
 *
 * 왜 로더인가: 예전에는 스크립트 전체(약 1만 자)를 사용자가 주소창에 붙여넣었다. 일부 폰(Chrome)에서 붙여넣을 때 글이 잘려
 * 아무 반응이 없었다. 그래서 주소창에는 **짧은 한 줄(스텁, 약 300자)** 만 붙이고, 본체는 우리 사이트의 버전 파일
 * (`/import-loader/<버전>.<언어>.js`)에서 불러온다.
 *
 * 왜 안전한가(SRI): 스텁에 **파일 내용의 해시(integrity)** 가 들어 있다. 서버의 파일이 한 글자라도 바뀌면 브라우저가 실행을 거부한다.
 * 그래서 서버가 침해돼도 사용자가 붙여넣은 스텁이 가리키는 "그 버전의 코드"만 실행된다(예전의 "붙여넣은 코드만 실행"과 같은 성질).
 *  - 버전 파일은 **바꾸지 않는다.** 코드나 문구를 고치면 새 버전(v2, v3…)을 추가하고 옛 파일은 남긴다(이미 복사된 스텁이 계속 작동한다).
 *  - 해시는 `import-loader-manifest.json`에 있고, 테스트(import-loader.test.ts)가 파일 내용과 맞는지, 옛 버전이 바뀌지 않았는지,
 *    최신 버전이 현재 소스와 같은지 검사한다. 새 버전 만들기: `UPDATE_IMPORT_LOADER=1 npx vitest run src/lib/import-loader.test.ts`
 *  - 파일은 교차 출처로 불러오므로 CORS 허용 헤더가 필요하다(next.config.ts의 /import-loader/*).
 * 서버(백엔드)는 여전히 공식 사이트와 통신하지 않고, 파일은 정적 파일이다.
 */

import type { Locale } from "@/i18n/config";
import type { Translator } from "@/i18n/translator";
import manifest from "@/lib/import-loader-manifest.json";

export interface LoaderManifest {
  /** 지금 복사 화면이 쓰는 버전(예: "v1") */
  latest: string;
  /** 버전 → 언어 → SRI 해시(`sha384-…`). 한 번 올린 항목은 바꾸지 않는다 */
  versions: Record<string, Record<Locale, string>>;
}

export const LOADER_MANIFEST: LoaderManifest = manifest as LoaderManifest;

/** 사이트 안의 버전 파일 경로. 파일은 public/import-loader/ 에 있다. */
export function loaderPath(version: string, locale: Locale): string {
  return `/import-loader/${version}.${locale}.js`;
}

/** 스텁 안의 글자열에 쓸 수 있게 따옴표·역슬래시·줄바꿈을 정리한다(문구에 작은따옴표가 있어도 깨지지 않게). */
function singleQuoted(text: string): string {
  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ")}'`;
}

/**
 * 주소창에 붙이는 한 줄(`javascript:` 접두사 제외 본문). 불러오기에 실패하면(네트워크·해시 불일치) 안내 글을 띄운다.
 * @param siteBase 사이트 주소(예: https://srpfreaks.com). 화면을 연 사이트의 origin
 * @param failedMessage 불러오기 실패 안내 문구(화면 언어)
 */
export function buildLoaderStub(siteBase: string, locale: Locale, failedMessage: string): string {
  const base = siteBase.replace(/\/+$/, "");
  const version = LOADER_MANIFEST.latest;
  const integrity = LOADER_MANIFEST.versions[version]?.[locale];
  if (!integrity) {
    throw new Error(`로더 해시가 없습니다: ${version}/${locale}`);
  }
  return (
    "(function(){var s=document.createElement('script');" +
    `s.src=${singleQuoted(base + loaderPath(version, locale))};` +
    `s.integrity=${singleQuoted(integrity)};` +
    "s.crossOrigin='anonymous';" +
    `s.onerror=function(){alert(${singleQuoted(failedMessage)})};` +
    "document.body.appendChild(s)})()"
  );
}

/** 스텁이 불러오기에 실패했을 때 띄우는 안내 문구(화면 언어). */
export function loaderFailedMessage(t: Translator): string {
  return t("Import.bmLoadFailed");
}
