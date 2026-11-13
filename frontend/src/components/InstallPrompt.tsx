"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  dismissInstallHint,
  isInstallHintDismissed,
  readInstallEnv,
  type BeforeInstallPromptEvent,
  type InstallEnv,
} from "@/lib/install-hint";
import { COARSE_POINTER_QUERY, useMediaQuery } from "@/lib/use-media-query";

/** 열린 방식(브라우저 / 홈 화면 앱 / iPhone Safari)을 읽는다. 서버 렌더는 항상 other라서 서버와 클라이언트 첫 화면이 같다(아래에서 터치 기기가 아니면 아무것도 그리지 않는다). */
function useInstallEnv(): InstallEnv {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia("(display-mode: standalone)");
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    readInstallEnv,
    () => "other",
  );
}

/**
 * "홈 화면에 추가" 안내 한 줄(D73). 휴대폰(터치 기기)에서만, 이 기기에서 처음 한 번만 보인다. `나중에`로 닫으면 다시 뜨지 않는다.
 * - Android(Chromium): 브라우저가 설치할 수 있다고 알려 줄 때(beforeinstallprompt)만 `추가하기` 버튼이 나온다. 눌러야 설치 창이 뜨도록 이벤트는 가로채 두기만 한다.
 * - iPhone/iPad Safari: 설치 창을 띄울 방법이 없어서 "Safari 공유 버튼 → 홈 화면에 추가" 문구만 보여 준다. 다른 iOS 브라우저는 방법이 달라 보이지 않는다.
 * - 이미 홈 화면 앱(standalone)으로 열었으면 보이지 않는다. 서비스 워커·오프라인 캐시는 만들지 않았다.
 * 위치: 고정 요소(하단 탭바·이전/다음 바·창)와 겹치지 않도록 닉네임 안내처럼 화면 흐름 맨 위에 둔다.
 */
export function InstallPrompt() {
  const t = useTranslations("Install");
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  const env = useInstallEnv();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // 서버에서도 호출되지만 localStorage가 없으면 false라 렌더 결과(null)에는 영향이 없다
  const [dismissed, setDismissed] = useState(() => isInstallHintDismissed());

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault(); // 브라우저 기본 미니 안내를 막고, 사용자가 `추가하기`를 눌렀을 때 직접 띄운다
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      dismissInstallHint();
      setDeferred(null);
      setDismissed(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!coarse || dismissed || env === "standalone") return null;
  const ios = env === "ios-safari";
  if (!ios && !deferred) return null; // Android는 설치할 수 있다고 알려 줄 때만

  function close() {
    dismissInstallHint();
    setDismissed(true);
  }

  async function install() {
    if (!deferred) return;
    setDeferred(null);
    try {
      await deferred.prompt();
      await deferred.userChoice; // 수락이든 거절이든 이 이벤트는 한 번만 쓸 수 있다
    } finally {
      close(); // 처음 한 번만 보여 준다
    }
  }

  return (
    <div role="region" aria-label={t("region")} className="motion-reveal flex flex-wrap items-center gap-2 border-b border-line bg-table-head px-4 py-2 text-sm text-fg-sub">
      <p className="min-w-0 flex-1 basis-56">{ios ? t("ios") : t("android")}</p>
      <div className="flex shrink-0 items-center gap-2">
        {!ios ? (
          <button type="button" onClick={() => void install()} className="min-h-11 rounded-lg border border-ctl px-3 text-sm font-semibold text-fg hover:bg-card">
            {t("add")}
          </button>
        ) : null}
        <button type="button" onClick={close} className="min-h-11 rounded-lg px-3 text-sm text-fg-sub hover:text-fg">
          {t("later")}
        </button>
      </div>
    </div>
  );
}
