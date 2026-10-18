"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { formatPlayedDate } from "@/lib/format";
import { buildBookmarkletHref } from "@/lib/import-bookmarklet";
import { API_BASE } from "@/lib/api";
import { fetchImportTokenStatus, importTokenKeys, issueImportToken, revokeImportToken } from "@/lib/import-token";

function messageOf(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}


/**
 * 북마클릿 안내. 토큰이 들어간 북마크 주소를 만들어 (1) 끌어다 놓을 링크, (2) 복사 버튼으로 준다.
 * React는 `javascript:` 주소를 href로 렌더링하지 않으므로, 링크의 href는 ref로 직접 넣는다(끌어서 북마크에 추가하는 용도이고 클릭해도 이 페이지에서는 실행하지 않는다).
 * 토큰이 북마크에 들어가므로 이 화면에서 한 번 더 주의를 안내한다.
 */
function BookmarkletGuide({ token }: { token: string }) {
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = buildBookmarkletHref(`${window.location.origin}${API_BASE}`, token);

  useEffect(() => {
    linkRef.current?.setAttribute("href", href);
  }, [href]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      toast("북마크 주소를 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 아래 링크를 북마크 바로 끌어다 놓아 주세요.");
    }
  }

  return (
    <div aria-label="북마클릿 안내" role="group" className="flex flex-col gap-2 rounded-xl border border-chip-line bg-page p-3">
      <p className="text-xs font-bold text-fg">가져오기 북마크 만들기</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-fg-sub">
        <li>
          아래 <b>SRP 가져오기</b> 링크를 북마크 바로 끌어다 놓습니다. 끌기 어려우면 <b>북마크 주소 복사</b>를 누르고, 새 북마크의 주소(URL)칸에 붙여넣어
          저장합니다.
        </li>
        <li>공식 사이트에서 최근 플레이(stage_result) 페이지를 열고, 브라우저 번역은 끕니다.</li>
        <li>북마크를 누르면 지금 보이는 페이지의 5곡을 보냅니다. 20곡이면 페이지를 넘겨 4번 누릅니다.</li>
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
        <button
          type="button"
          onClick={() => void copy()}
          className="h-10 rounded-xl border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg"
        >
          북마크 주소 복사
        </button>
      </div>
      <p className="text-xs text-danger">이 북마크에는 토큰이 들어 있습니다. 다른 사람에게 공유하지 마세요. 토큰을 폐기하면 북마크도 쓸 수 없게 됩니다.</p>
    </div>
  );
}

/**
 * 가져오기 토큰 발급·폐기 패널.
 * - 토큰 원문은 발급 응답에만 있으므로 이 컴포넌트의 state(메모리)에만 둔다. localStorage 등에는 저장하지 않는다.
 * - 이미 있는 토큰을 다시 발급하면 이전 토큰은 폐기된다(사용자당 하나).
 */
export function ImportTokenPanel({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const status = useQuery({ queryKey: importTokenKeys.status(userId), queryFn: fetchImportTokenStatus });

  const issue = useMutation({
    mutationFn: issueImportToken,
    onSuccess: (issued) => {
      setIssuedToken(issued.token);
      void queryClient.invalidateQueries({ queryKey: importTokenKeys.status(userId) });
    },
  });
  const revoke = useMutation({
    mutationFn: revokeImportToken,
    onSuccess: () => {
      setIssuedToken(null);
      setConfirmRevoke(false);
      toast("가져오기 토큰을 폐기했습니다.");
      void queryClient.invalidateQueries({ queryKey: importTokenKeys.status(userId) });
    },
  });

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      toast("토큰을 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 토큰을 직접 선택해 복사해 주세요.");
    }
  }

  const card = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
  const exists = status.data?.exists === true;

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="가져오기 안내" className={card}>
        <h2 className="text-xs font-bold text-fg-sub">이 기능은</h2>
        <p className="text-sm leading-relaxed text-fg">
          공식 사이트의 최근 플레이 결과(최대 20곡)를 직접 입력하지 않고 가져옵니다. 이 사이트는 Konami 계정이나 쿠키를 받지 않고, 공식 사이트와
          통신하지도 않습니다. 내 브라우저가 열어 둔 페이지의 달성률 등 값만 읽어 보냅니다.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-fg-sub">
          <li>S.RANDOM+, BUTTON OFF, AUTO OFF 옵션으로 한 플레이만 저장합니다.</li>
          <li>곡 목록에 없는 곡은 제외하고, 제외된 곡명을 결과에서 알려 드립니다.</li>
          <li>기존 최고 기록보다 낮은 기록은 저장하지 않습니다.</li>
          <li>페이지는 5곡씩이라 20곡이면 4번 실행합니다.</li>
          <li>공식 페이지의 브라우저 번역은 꺼 두세요. 번역된 페이지는 곡명을 읽을 수 없어 건너뜁니다.</li>
        </ul>
      </section>

      <section aria-label="가져오기 토큰" className={card}>
        <h2 className="text-xs font-bold text-fg-sub">가져오기 토큰</h2>
        {status.isPending ? (
          <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
        ) : status.isError ? (
          <p role="alert" className="text-sm text-danger">
            상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : exists ? (
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-sub">상태</dt>
              <dd className="font-bold text-fg">발급됨</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-sub">발급일</dt>
              <dd className="text-fg">{formatPlayedDate(status.data.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-sub">마지막 사용</dt>
              <dd className="text-fg">{status.data.lastUsedAt ? formatPlayedDate(status.data.lastUsedAt) : "사용 기록 없음"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-fg-sub">발급된 토큰이 없습니다.</p>
        )}

        {issuedToken ? (
          <div role="status" className="flex flex-col gap-2 rounded-xl border border-chip-line bg-page p-3">
            <p className="text-xs font-bold text-danger">이 토큰은 지금 한 번만 보입니다. 복사해 두세요.</p>
            <code aria-label="발급된 토큰" className="break-all text-xs text-fg">
              {issuedToken}
            </code>
            <button
              type="button"
              onClick={() => void copy(issuedToken)}
              className="h-10 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
            >
              복사
            </button>
          </div>
        ) : null}
        {issuedToken ? <BookmarkletGuide token={issuedToken} /> : null}

        <p role="alert" className="min-h-4 text-xs text-danger">
          {messageOf(issue.error) ?? messageOf(revoke.error)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={issue.isPending || status.isPending}
            onClick={() => {
              issue.reset();
              issue.mutate();
            }}
            className="h-11 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
          >
            {exists ? "다시 발급" : "토큰 발급"}
          </button>
          {exists ? (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="h-11 rounded-xl border border-danger px-5 text-sm font-extrabold text-danger hover:bg-table-head"
            >
              폐기
            </button>
          ) : null}
        </div>
        {exists ? <p className="text-xs text-fg-dim">다시 발급하면 이전 토큰은 바로 쓸 수 없게 됩니다.</p> : null}
        <p className="text-xs text-fg-dim">토큰은 비밀번호처럼 다루세요. 다른 사람에게 알려 주지 마세요. 이 토큰으로는 최근 플레이 가져오기만 할 수 있습니다.</p>
      </section>

      <ConfirmDialog
        open={confirmRevoke}
        title="가져오기 토큰 폐기"
        message="토큰을 폐기하면 이 토큰으로는 더 이상 가져올 수 없습니다. 폐기할까요?"
        confirmLabel="폐기"
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirmRevoke(false)}
      />
    </div>
  );
}
