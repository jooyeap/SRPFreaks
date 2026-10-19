"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import { canUseImport } from "@/lib/features";
import { formatRate, formatScore } from "@/lib/format";
import { clearHandoff, MAX_PAGES, pagesReceived, removePlays, useHandoff } from "@/lib/import-handoff";
import { buildHandoffBookmarkletHref, buildHandoffBookmarkletSource, type ReadPlay } from "@/lib/import-bookmarklet";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import {
  commitRecentPlays,
  describePlayChart,
  isExcludedReason,
  playKey,
  playStage,
  previewRecentPlays,
  SKIP_REASON_LABELS,
  type ImportPlayResult,
} from "@/lib/record-import";
import { AFFECTED_QUERY_KEYS } from "@/lib/records";

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function GuideImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="mt-2 flex flex-col gap-1">
      {/* 정적 안내 이미지(개인 정보는 가림 처리). next/image 최적화가 필요 없는 작은 파일이라 일반 img를 쓴다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={954} height={118} loading="lazy" className="h-auto w-full rounded-lg border border-line" />
      <figcaption className="text-xs text-fg-sub">{caption}</figcaption>
    </figure>
  );
}

/** 북마크 만들기 + 사용 방법. 토큰이 필요 없고 북마크에는 사이트 주소만 들어 있다. */
function BookmarkGuide() {
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = buildHandoffBookmarkletHref(window.location.origin);

  useEffect(() => {
    // React는 javascript: 주소를 href로 렌더링하지 않아서 ref로 직접 넣는다(끌어서 북마크에 추가하는 용도, 클릭해도 여기서는 실행하지 않는다)
    linkRef.current?.setAttribute("href", href);
  }, [href]);

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

  return (
    <section aria-label="사용 방법" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-xs font-bold text-fg-sub">사용 방법 (북마크는 한 번만 추가)</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-fg-sub">
        <li>공식 최근 플레이 페이지(번역 끔)에서 북마크를 누릅니다.</li>
        <li>이 화면이 열리면서 읽은 값이 전달됩니다. 토큰은 필요 없습니다.</li>
        <li>아래에서 확인하고 저장합니다. 다음 페이지는 같은 방법으로 이어서 보냅니다.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2 pt-1">
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
      <p className="text-xs text-fg-sub">링크를 북마크 바로 끌어다 놓거나, 주소를 복사해 새 북마크의 URL칸에 붙여넣습니다.</p>
      <GuideImage
        src="/import-guide/bookmark-drag.png"
        alt="북마크 바에 SRP 가져오기 북마크가 추가된 브라우저 화면"
        caption="북마크 바에 SRP 가져오기가 추가된 모습(개인 정보는 가렸습니다)."
      />
      <details className="rounded-xl border border-chip-line p-3">
        <summary className="min-h-8 cursor-pointer text-sm font-bold text-fg">북마크 없이 주소창에서 실행하기 (모바일)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-fg-sub">
          <li>
            <button type="button" onClick={() => void copyBody()} className="h-9 rounded-lg border border-chip-line px-3 text-sm font-bold text-fg">
              실행용 스크립트 복사
            </button>{" "}
            를 누릅니다.
          </li>
          <li>공식 최근 플레이 페이지(번역 끔)를 연 상태에서 주소창을 누르고 기존 주소를 지웁니다.</li>
          <li>
            주소창에 <b className="font-num text-fg">j</b> 한 글자만 입력하고, 바로 뒤에 복사한 내용을 붙여넣어 이동합니다.
          </li>
        </ol>
        <GuideImage
          src="/import-guide/address-bar.png"
          alt="주소창에 j를 입력하고 복사한 스크립트를 붙여넣은 브라우저 화면"
          caption="주소창에 j를 입력한 뒤 붙여넣은 모습(개인 정보는 가렸습니다)."
        />
        <p className="mt-2 text-xs text-fg-sub">브라우저가 붙여넣은 글자가 javascript:로 시작하면 그 부분을 지우기 때문에, 맨 앞 j만 직접 입력합니다. 일부 앱 안의 브라우저에서는 실행되지 않을 수 있습니다.</p>
      </details>
    </section>
  );
}

function ProgressBar({ done }: { done: number }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${done}쪽 완료, 총 ${MAX_PAGES}쪽`}>
      {Array.from({ length: MAX_PAGES }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-chip-on-bg" : "bg-chip-line"}`} />
      ))}
    </div>
  );
}

function PlayRow({
  play,
  result,
  checked,
  onToggle,
}: {
  play: ReadPlay;
  result: ImportPlayResult;
  checked: boolean;
  onToggle: () => void;
}) {
  const excluded = isExcludedReason(result.reason);
  const chart = describePlayChart(play.difficultyClass);
  let note: string;
  if (result.saved) {
    note = result.previousBestRate === null ? "첫 기록" : `새 기록 · ${formatRate(result.previousBestRate)} → ${formatRate(play.rate / 100)}`;
  } else if (result.reason) {
    const label = SKIP_REASON_LABELS[result.reason];
    note = excluded ? `제외 · ${label}` : result.previousBestRate !== null && result.reason === "LOWER_THAN_BEST" ? `건너뜀 · 기존 기록(${formatRate(result.previousBestRate)})보다 낮음` : `건너뜀 · ${label}`;
  } else {
    note = "";
  }
  return (
    <li className={`flex items-center gap-3 border-t border-line py-3 ${result.saved ? "" : "opacity-75"}`}>
      <input
        type="checkbox"
        checked={result.saved && checked}
        disabled={!result.saved}
        onChange={onToggle}
        aria-label={`${play.title} ${result.saved ? "저장" : "저장 안 함"}`}
        className="size-5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-fg">{play.title}</div>
        {chart && <div className="mt-0.5 text-xs text-fg-sub">{chart}</div>}
        <div className={`mt-0.5 text-xs ${excluded ? "text-weak-text" : result.saved ? "text-fg" : "text-fg-sub"}`}>{note}</div>
        {excluded && (
          <Link href={`/suggestions?category=SONG_REQUEST&title=${encodeURIComponent(play.title.slice(0, 100))}`} className="mt-0.5 inline-flex min-h-8 items-center text-xs underline">
            곡 추가 건의하기
          </Link>
        )}
      </div>
      <div className="shrink-0 text-right">
        {result.saved && <StageBadge stage={playStage(play)} />}
        <div className="mt-0.5 font-num text-sm text-fg-sub">{formatRate(play.rate / 100)}</div>
      </div>
    </li>
  );
}

interface DoneInfo {
  saved: number;
  before: number | null;
  after: number | null;
}

function ratingLine(done: DoneInfo): string | null {
  if (done.before === null || done.after === null) return null;
  const diff = Math.round((done.after - done.before) * 100) / 100;
  if (diff === 0) return "레이팅은 그대로입니다.";
  return `레이팅 ${diff > 0 ? "+" : "-"}${formatScore(Math.abs(diff))} (${formatScore(done.before)} → ${formatScore(done.after)})`;
}

/** 최근 플레이 가져오기 화면(D40): 받은 플레이를 미리 확인하고, 고른 것만 저장한다. */
export function RecordImportView({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const handoff = useHandoff();
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [done, setDone] = useState<DoneInfo | null>(null);
  const pending = handoff.pending;
  const pendingKeys = pending.map(playKey).join("\n");

  const preview = useQuery({
    queryKey: ["import-preview", userId, pendingKeys],
    queryFn: () => previewRecentPlays(pending),
    enabled: pending.length > 0,
    staleTime: 0,
    gcTime: 0,
  });

  const commit = useMutation({
    mutationFn: async (selected: ReadPlay[]) => {
      // 레이팅 변화는 저장 전후의 합계 차이로 보여 준다(조회에 실패해도 저장 결과는 그대로 보여 준다)
      const read = () => queryClient.fetchQuery({ queryKey: skillKeys.me(userId), queryFn: ({ signal }) => fetchMySkill(signal), staleTime: 0 }).then((s) => s.totalScore, () => null);
      const before = await read();
      const result = await commitRecentPlays(selected);
      await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
      const after = result.saved > 0 ? await read() : before;
      return { saved: result.saved, before, after };
    },
    onSuccess: (info) => {
      setDone(info);
      removePlays(pending);
      setUnchecked(new Set());
    },
  });

  const results = preview.data?.results;
  const byIndex = new Map<number, ImportPlayResult>((results ?? []).map((r) => [r.index, r]));
  const selectable = pending.filter((_, i) => byIndex.get(i)?.saved);
  const selected = selectable.filter((p) => !unchecked.has(playKey(p)));
  const skippedCount = (results ?? []).filter((r) => !r.saved && !isExcludedReason(r.reason)).length;
  const excludedCount = (results ?? []).filter((r) => isExcludedReason(r.reason)).length;
  const donePages = pagesReceived(handoff);

  function toggle(key: string) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const line = done ? ratingLine(done) : null;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3 pb-4">
      <h1 className="text-xl font-bold text-fg">최근 플레이 가져오기</h1>

      {done && (
        <section role="status" className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
          <p className="text-base font-bold text-fg">{done.saved > 0 ? `✓ ${done.saved}곡을 저장했습니다` : "저장된 기록이 없습니다"}</p>
          {line && <p className="text-sm text-fg-sub">{line}</p>}
        </section>
      )}

      {pending.length === 0 ? (
        <>
          {done ? (
            <>
              <section className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
                <h2 className="text-sm font-bold text-fg">다음 페이지도 가져오기</h2>
                <ProgressBar done={donePages} />
                <p className="text-sm leading-relaxed text-fg-sub">
                  {donePages}/{MAX_PAGES}쪽을 가져왔습니다. 공식 페이지에서 다음 쪽을 열고 북마크를 다시 누르면 이 화면에 이어서 쌓입니다.
                </p>
              </section>
              <div className="flex gap-2">
                <Link href="/me" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-chip-line text-sm font-medium text-fg">
                  내 기록 보기
                </Link>
                <Link href="/me?tab=rating" className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-chip-on-bg text-sm font-bold text-chip-on-fg">
                  내 레이팅 보기
                </Link>
              </div>
            </>
          ) : (
            <p className="rounded-2xl border border-line bg-card p-4 text-sm text-fg-sub">받은 플레이가 없습니다. 아래 방법으로 공식 페이지에서 북마크를 눌러 주세요.</p>
          )}
          <BookmarkGuide />
        </>
      ) : (
        <>
          <BookmarkGuide />
          <section className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-fg">공식 페이지에서 받은 플레이 {pending.length}곡</h2>
              <span className="text-xs text-fg-sub">
                {donePages}/{MAX_PAGES}쪽
              </span>
            </div>
            {preview.isPending && <p className="text-sm text-fg-sub">확인하는 중입니다.</p>}
            {preview.isError && (
              <p role="alert" className="text-sm text-danger">
                {messageOf(preview.error)}
              </p>
            )}
            {results && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-chip-line px-2.5 py-1 font-bold text-fg">✓ 저장 예정 {selected.length}</span>
                  <span className="rounded-full border border-chip-line px-2.5 py-1 text-fg-sub">건너뜀 {skippedCount}</span>
                  {excludedCount > 0 && <span className="rounded-full border border-weak-line px-2.5 py-1 text-weak-text">제외 {excludedCount}</span>}
                </div>
                <ul>
                  {pending.map((play, i) => {
                    const result = byIndex.get(i);
                    return result ? <PlayRow key={playKey(play)} play={play} result={result} checked={!unchecked.has(playKey(play))} onToggle={() => toggle(playKey(play))} /> : null;
                  })}
                </ul>
              </>
            )}
          </section>
          <p className="text-xs leading-relaxed text-fg-sub">같은 곡을 다시 보내도 서버가 걸러서 중복 저장되지 않습니다. 기록은 SRN+ 옵션으로 플레이한 것만 저장합니다.</p>
          {commit.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageOf(commit.error)}
            </p>
          )}
          <div className="sticky bottom-0 flex gap-2 bg-page py-3">
            <button
              type="button"
              onClick={() => {
                clearHandoff();
                setDone(null);
              }}
              disabled={commit.isPending}
              className="min-h-12 rounded-xl border border-chip-line px-4 text-sm font-medium text-fg disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => commit.mutate(selected)}
              disabled={commit.isPending || !results || selected.length === 0}
              className="min-h-12 flex-1 rounded-xl bg-chip-on-bg text-[15px] font-bold text-chip-on-fg disabled:opacity-60"
            >
              {commit.isPending ? "저장하는 중" : `${selected.length}곡 저장`}
            </button>
          </div>
        </>
      )}
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
  return <RecordImportView userId={user.id} />;
}
