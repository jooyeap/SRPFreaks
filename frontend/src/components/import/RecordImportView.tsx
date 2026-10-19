"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { canUseImport } from "@/lib/features";
import { buildHandoffBookmarkletHref, buildHandoffBookmarkletSource } from "@/lib/import-bookmarklet";

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
  const chips = ["메인 화면", "상단 플레이 데이터", "좌측 슬라이드바 플레이 이력"];
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
      <p className="text-xs text-fg-dim">주소에 stage_result가 들어 있는 최근 플레이 페이지입니다. 번역은 꺼 주세요.</p>
    </div>
  );
}

const GUIDE_CARD = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";

/**
 * 가져오기 사용 방법. 환경(PC/모바일) 탭 → 준비 → 실행(매번) → 저장 기준 → 실행 오류 순서다.
 * 토큰이 필요 없고 북마크에는 사이트 주소만 들어 있다. 기본 탭은 터치 기기면 모바일, 아니면 PC.
 */
function BookmarkGuide() {
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = buildHandoffBookmarkletHref(window.location.origin);
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
      toast("북마크 주소를 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 링크를 북마크 바로 끌어다 놓아 주세요.");
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
      await navigator.clipboard.writeText(`avascript:${encodeURIComponent(buildHandoffBookmarkletSource(window.location.origin))}`);
      toast("실행용 스크립트를 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 브라우저의 복사 권한을 확인해 주세요.");
    }
  }

  const tabs: { value: GuideTab; label: string }[] = [
    { value: "pc", label: "PC" },
    { value: "mobile", label: "모바일" },
  ];
  const faq = "border-t border-line pt-3";

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="사용하는 환경" className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">① 사용하는 환경</h2>
        <div role="tablist" aria-label="사용하는 환경" className="flex gap-1 rounded-xl border border-line bg-table-head p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`min-h-10 flex-1 rounded-lg px-4 text-sm ${tab === t.value ? "bg-card font-bold text-fg shadow-sm ring-1 ring-chip-line" : "text-fg-sub hover:text-fg"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-fg-dim">토큰이나 계정 정보는 필요 없습니다.</p>
      </section>

      <section aria-label={tab === "pc" ? "준비 (처음 한 번만)" : "준비 (스크립트 복사)"} className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">{tab === "pc" ? "② 준비 · 처음 한 번만" : "② 준비 · 스크립트 복사"}</h2>
        {tab === "pc" ? (
          <>
            <ol className="flex flex-col gap-3">
              <GuideStep n={1}>
                아래 버튼을 <b className="text-fg">마우스로 끌어서 북마크 바에 놓습니다.</b> 그림처럼 따라 해 주세요.
              </GuideStep>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <a
                ref={linkRef}
                draggable
                onClick={(e) => e.preventDefault()}
                className="inline-flex h-10 items-center rounded-xl bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg"
              >
                SRP 가져오기
              </a>
              <button type="button" onClick={() => void copy()} className="h-10 rounded-xl border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg">
                북마크 주소 복사
              </button>
            </div>
            <GuideImage
              src="/import-guide/bookmark-drag-howto.svg"
              alt="SRP 가져오기 버튼을 마우스로 누른 채 위쪽 북마크 바까지 끌어서 놓는 방법을 보여 주는 그림"
              caption="① 버튼 위에서 마우스 왼쪽 버튼을 누른 채로 ② 위쪽 북마크 바까지 끌어서 ③ 놓습니다."
              width={440}
              height={236}
            />
            <p className="text-xs text-fg-dim">북마크 바가 안 보이면 Ctrl+Shift+B(Mac은 ⌘+Shift+B)를 눌러 켭니다. 끌어다 놓기가 어려우면 북마크 주소를 복사해 새 북마크의 URL칸에 붙여넣어도 됩니다.</p>
            <GuideImage
              src="/import-guide/bookmark-drag.png"
              alt="북마크 바에 SRP 가져오기 북마크가 추가된 브라우저 화면"
              caption="북마크 바에 SRP 가져오기가 추가된 모습."
            />
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              <GuideStep n={1}>
                아래 버튼으로 <b className="text-fg">실행용 스크립트를 복사</b>합니다.
              </GuideStep>
            </ol>
            <div>
              <button type="button" onClick={() => void copyBody()} className="inline-flex h-10 items-center rounded-xl bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg">
                실행용 스크립트 복사
              </button>
            </div>
            <p className="text-xs text-fg-dim">폰에서는 북마크 끌어다 놓기를 쓸 수 없어 주소창으로 실행합니다. 이 방법은 매번 같은 순서로 진행합니다.</p>
          </>
        )}
      </section>

      <section aria-label="실행" className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">③ 실행 · 매번</h2>
        <ol className="flex flex-col gap-3">
          <GuideStep n={1}>
            기타도라 공식 사이트에서 <b className="text-fg">최근 플레이</b> 페이지를 엽니다.
          </GuideStep>
        </ol>
        <OfficialPath />
        <ol start={2} className="flex flex-col gap-3">
          {tab === "pc" ? (
            <>
              <GuideStep n={2}>
                그 페이지에서 <b className="text-fg">북마크를 누릅니다.</b> 1~4쪽(최대 20곡)을 함께 읽어 옵니다. 다른 페이지에서는 동작하지 않고 안내만 뜹니다.
              </GuideStep>
              <GuideStep n={3}>
                이 화면에서 <b className="text-fg">미리보기를 확인하고 저장</b>합니다.
              </GuideStep>
            </>
          ) : (
            <>
              <GuideStep n={2}>
                주소창을 눌러 기존 주소를 지우고 <b className="font-num text-fg">j</b> 한 글자만 입력합니다.
              </GuideStep>
              <GuideStep n={3}>
                바로 뒤에 복사한 내용을 <b className="text-fg">붙여넣고 이동</b>합니다. 1~4쪽(최대 20곡)을 함께 읽어 옵니다. 다른 페이지에서는 동작하지 않고 안내만 뜹니다.
              </GuideStep>
            </>
          )}
        </ol>
        {tab === "mobile" && (
          <>
            <GuideImage src="/import-guide/address-bar.png" alt="주소창에 j를 입력하고 복사한 스크립트를 붙여넣은 브라우저 화면" caption="주소창에 j를 입력한 뒤 붙여넣은 모습." />
            <ol start={4} className="flex flex-col gap-3">
              <GuideStep n={4}>
                이 화면에서 <b className="text-fg">미리보기를 확인하고 저장</b>합니다.
              </GuideStep>
            </ol>
            <p className="text-xs text-fg-dim">브라우저가 붙여넣은 글자가 javascript:로 시작하면 그 부분을 지우기 때문에, 맨 앞 j만 직접 입력합니다. 일부 앱 안의 브라우저에서는 실행되지 않을 수 있습니다.</p>
          </>
        )}
      </section>

      <section aria-label="저장 기준" className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">어떤 기록이 저장되나요?</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-sub">
          <li>
            <b className="text-fg">S.RANDOM+</b> 옵션(BUTTON OFF, AUTO OFF)으로 친 플레이만 저장됩니다.
          </li>
          <li>
            기존 <b className="text-fg">최고 기록보다 낮으면</b> 건너뜁니다. 같은 값은 중복 저장되지 않습니다.
          </li>
          <li>
            곡 목록에 없는 곡은 <b className="text-fg">제외</b>되고, 필요시 건의하기로 이어집니다.
          </li>
          <li>저장 전에 미리보기에서 곡마다 체크를 풀 수 있습니다.</li>
        </ul>
      </section>

      <section aria-label="실행 오류" className={GUIDE_CARD}>
        <h2 className="text-sm font-bold text-fg">실행 오류</h2>
        <details open>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">안내 창만 뜨고 아무 일도 안 일어나요</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">공식 최근 플레이 페이지(주소에 stage_result 포함)에서 눌러야 합니다. 다른 페이지에서는 안내만 뜹니다.</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">번역을 켜 둔 상태예요</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">번역된 페이지는 곡명을 정확히 읽을 수 없어 아무것도 보내지 않습니다. 주소창의 번역 아이콘에서 원본 보기를 선택한 뒤 새로고침해 주세요.</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">팝업이 차단됐다고 나와요</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">안내 창의 SRPFreaks 열기 버튼을 누르면 같은 내용으로 열립니다.</p>
        </details>
        <details className={faq}>
          <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-fg">일부 쪽을 불러오지 못했다고 나와요</summary>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-dim">불러온 쪽만 보내고, 빠진 쪽은 해당 페이지에서 다시 실행하면 이어서 쌓입니다.</p>
        </details>
      </section>
    </div>
  );
}

/** 가져오기 안내 화면(D40): 북마크 만들기·실행 방법만 보여 준다. 받은 플레이의 확인·저장은 어느 화면에서든 뜨는 모달(ImportHandoff)이 처리한다. */
export function RecordImportView() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 pb-4">
      <h1 className="text-xl font-bold text-fg">최근 플레이 가져오기</h1>
      <BookmarkGuide />
    </section>
  );
}

/** 로그인 상태에 따라 안내/화면을 고르는 껍데기. */
export function RecordImportGate() {
  const { status, user } = useAuth();
  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">최근 플레이 가져오기</h1>
        <p className="text-sm text-fg-sub">로그인한 뒤 받은 플레이를 확인하고 저장할 수 있습니다.</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  if (!canUseImport(user.role)) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">최근 플레이 가져오기</h1>
        <p className="text-sm text-fg-sub">이 기능은 아직 준비 중입니다.</p>
      </section>
    );
  }
  return <RecordImportView />;
}
