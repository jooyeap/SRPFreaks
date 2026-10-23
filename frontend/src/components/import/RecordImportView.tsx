"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { canUseImport } from "@/lib/features";
import { bookmarkletMessages, buildHandoffBookmarkletHref, buildHandoffBookmarkletSource, encodeBookmarklet } from "@/lib/import-bookmarklet";
import { useTranslations } from "next-intl";

type GuideTab = "pc" | "mobile";

function GuideImage({ src, alt, caption, width = 954, height = 118 }: { src: string; alt: string; caption: string; width?: number; height?: number }) {
  return (
    <figure className="flex flex-col gap-1">
      {/* 정적 안내 이미지(개인 정보는 가림 처리). next/image 최적화가 필요 없는 작은 파일이라 일반 img를 쓴다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} loading="lazy" className="h-auto w-full rounded-lg border border-line" />
      <figcaption className="text-xs text-fg-sub">{caption}</figcaption>
    </figure>
  );
}

function GuideStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-chip-on-bg text-xs font-extrabold text-chip-on-fg">
        {n}
      </span>
      <div className="text-sm leading-relaxed text-fg-sub">{children}</div>
    </li>
  );
}

/** 공식 사이트에서 최근 플레이 페이지까지 가는 길(메뉴 이름은 공식 사이트 표기 그대로). */
function OfficialPath() {
  const t = useTranslations();
  const chips = [t("Import.chipMain"), t("Import.chipPlayData"), t("Import.chipHistory")];
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-sub">
        {chips.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">›</span>}
            <span className="rounded-lg border border-line bg-table-head px-2.5 py-1 font-bold text-fg">{c}</span>
          </span>
        ))}
      </p>
      <p className="text-xs text-fg-dim">{t("Import.officialNote")}</p>
    </div>
  );
}

const GUIDE_CARD = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";

/**
 * 가져오기 사용 방법. 환경(PC/모바일) 탭 → 준비 → 실행(매번) → 저장 기준 → 실행 오류 순서다.
 * 토큰이 필요 없고 북마크에는 사이트 주소만 들어 있다. 기본 탭은 터치 기기면 모바일, 아니면 PC.
 */
function BookmarkGuide() {
  const t = useTranslations();
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const messages = bookmarkletMessages(t);
  const href = buildHandoffBookmarkletHref(window.location.origin, messages);
  const [tab, setTab] = useState<GuideTab>(() =>
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches ? "mobile" : "pc",
  );

  useEffect(() => {
    // React는 javascript: 주소를 href로 렌더링하지 않아서 ref로 직접 넣는다(끌어서 북마크에 추가하는 용도, 클릭해도 여기서는 실행하지 않는다)
    linkRef.current?.setAttribute("href", href);
  }, [href, tab]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      toast(t("Import.bookmarkCopied"));
    } catch {
      toast(t("Import.copyFailedBookmark"));
    }
  }

  /**
   * 주소창에 직접 붙여넣어 실행하는 방법(북마크를 만들기 어려운 모바일용).
   * 브라우저(Chrome·Safari 등)는 붙여넣은 글자가 `javascript:`로 시작하면 보안상 그 부분을 지운다.
   * 그래서 맨 앞 `j`만 뺀 `avascript:...`를 복사하고, 사용자는 주소창에 `j`만 입력한 뒤 붙여넣는다
   * (붙여넣은 글자 자체는 `javascript:`로 시작하지 않아 지워지지 않는다). 본문은 북마크와 같은 코드이고 토큰·비밀값이 없다.
   */
  async function copyBody() {
    try {
      await navigator.clipboard.writeText(`avascript:${encodeBookmarklet(buildHandoffBookmarkletSource(window.location.origin, messages))}`);
      toast(t("Import.scriptCopied"));
    } catch {
      toast(t("Import.copyFailedScript"));
    }
  }

  const tabs: { value: GuideTab; label: string }[] = [
    { value: "pc", label: "PC" },
    { value: "mobile", label: t("Import.tabMobile") },
  ];
  const faq = "border-t border-line pt-3";

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t("Import.envAria")} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{t("Import.envHeading")}</h2>
        <div role="tablist" aria-label={t("Import.envAria")} className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={`min-h-10 flex-1 rounded-lg px-4 text-sm ${tab === item.value ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-dim">{t("Import.noToken")}</p>
      </section>

      <section aria-label={tab === "pc" ? t("Import.prepPcAria") : t("Import.prepMobileAria")} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{tab === "pc" ? t("Import.prepPcHeading") : t("Import.prepMobileHeading")}</h2>
        {tab === "pc" ? (
          <>
            <ol className="flex flex-col gap-3">
              <GuideStep n={1}>
                {t.rich("Import.stepDrag", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <a
                ref={linkRef}
                draggable
                onClick={(e) => e.preventDefault()}
                className="inline-flex h-10 items-center rounded-xl bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg"
              >
                {t("Import.bookmarkName")}
              </a>
              <button type="button" onClick={() => void copy()} className="h-10 rounded-xl border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg">
                {t("Import.copyBookmark")}
              </button>
            </div>
            <GuideImage
              src="/import-guide/bookmark-drag-howto.svg"
              alt={t("Import.dragAlt")}
              caption={t("Import.dragCaption")}
              width={440}
              height={236}
            />
            <p className="text-xs text-fg-dim">{t("Import.barHint")}</p>
            <GuideImage
              src="/import-guide/bookmark-drag.png"
              alt={t("Import.barAlt")}
              caption={t("Import.barCaption")}
            />
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              <GuideStep n={1}>
                {t.rich("Import.stepCopyScript", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
            </ol>
            <div>
              <button type="button" onClick={() => void copyBody()} className="inline-flex h-10 items-center rounded-xl bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg">
                {t("Import.copyScriptBtn")}
              </button>
            </div>
            <p className="text-xs text-fg-dim">{t("Import.phoneNote")}</p>
          </>
        )}
      </section>

      <section aria-label={t("Import.runAria")} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{t("Import.runHeading")}</h2>
        <ol className="flex flex-col gap-3">
          <GuideStep n={1}>
            {t.rich("Import.stepOpen", { b: (c) => <b className="text-fg">{c}</b> })}
          </GuideStep>
        </ol>
        <OfficialPath />
        <ol start={2} className="flex flex-col gap-3">
          {tab === "pc" ? (
            <>
              <GuideStep n={2}>
                {t.rich("Import.stepPc2", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
              <GuideStep n={3}>
                {t.rich("Import.stepPreview", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
            </>
          ) : (
            <>
              <GuideStep n={2}>
                {t.rich("Import.stepM2", { bn: (c) => <b className="font-num text-fg">{c}</b> })}
              </GuideStep>
              <GuideStep n={3}>
                {t.rich("Import.stepM3", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
            </>
          )}
        </ol>
        {tab === "mobile" && (
          <>
            <GuideImage src="/import-guide/address-bar.png" alt={t("Import.addrAlt")} caption={t("Import.addrCaption")} />
            <p className="text-sm leading-relaxed text-fg-sub">
              {t.rich("Import.enterTip", { b: (c) => <b className="text-fg">{c}</b> })}
            </p>
            <GuideImage src="/import-guide/address-suggest.png" alt={t("Import.globeAlt")} caption={t("Import.globeCaption")} width={832} height={388} />
            <ol start={4} className="flex flex-col gap-3">
              <GuideStep n={4}>
                {t.rich("Import.stepPreview", { b: (c) => <b className="text-fg">{c}</b> })}
              </GuideStep>
            </ol>
            <p className="text-xs text-fg-dim">{t("Import.jNote")}</p>
          </>
        )}
      </section>

      <section aria-label={t("Import.criteriaAria")} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{t("Import.criteriaHeading")}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-sub">
          <li>
            {t.rich("Import.crit1", { b: (c) => <b className="text-fg">{c}</b> })}
          </li>
          <li>
            {t.rich("Import.crit2", { b: (c) => <b className="text-fg">{c}</b> })}
          </li>
          <li>
            {t.rich("Import.crit3", { b: (c) => <b className="text-fg">{c}</b> })}
          </li>
          <li>{t("Import.crit4")}</li>
        </ul>
      </section>

      <section aria-label={t("Import.errAria")} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{t("Import.errHeading")}</h2>
        <details open>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">{t("Import.faq1q")}</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{t("Import.faq1a")}</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">{t("Import.faq2q")}</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{t("Import.faq2a")}</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">{t("Import.faq3q")}</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{t("Import.faq3a")}</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">{t("Import.faq4q")}</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">{t("Import.faq4a")}</p>
        </details>
      </section>
    </div>
  );
}

/** 가져오기 안내 화면(D40): 북마크 만들기·실행 방법만 보여 준다. 받은 플레이의 확인·저장은 어느 화면에서든 뜨는 모달(ImportHandoff)이 처리한다. */
export function RecordImportView() {
  const t = useTranslations();
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 pb-4">
      <h1 className="text-xl font-bold text-fg">{t("Import.title")}</h1>
      <BookmarkGuide />
    </section>
  );
}

/** 로그인 상태에 따라 안내/화면을 고르는 껍데기. */
export function RecordImportGate() {
  const t = useTranslations();
  const { status, user } = useAuth();
  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Import.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Import.loginLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Import.login")}
        </Link>
      </section>
    );
  }
  if (!canUseImport(user.role)) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Import.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Import.notReady")}</p>
      </section>
    );
  }
  return <RecordImportView />;
}
