"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOptionalUser } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { AFFECTED_QUERY_KEYS, deleteRecord, type RecordResponse } from "@/lib/records";
import { useTranslations } from "next-intl";

/** 삭제를 누른 뒤 서버에 요청을 보내기까지 기다리는 시간(되돌릴 수 있는 시간). 토스트의 남은 시간 막대도 같은 값이다. */
export const UNDO_WINDOW_MS = 5000;

interface RecordDeleteContextValue {
  /**
   * 본인 기록 삭제를 예약한다: 목록에서 바로 숨기고, 5초짜리 `되돌리기` 토스트를 띄운 뒤, 5초 안에 되돌리지 않으면 서버에 삭제를 보낸다.
   * 이미 대기 중인 기록이면 아무것도 하지 않고 false(같은 기록을 두 번 눌러도 토스트·요청이 하나다). 로그인하지 않았어도 false.
   */
  requestDelete: (record: RecordResponse) => boolean;
  /** 삭제 대기 중이거나 서버 응답을 기다리는 기록 id. 기록 목록은 이 id를 그리지 않는다(낙관적 제거). */
  hiddenIds: ReadonlySet<number>;
}

const EMPTY: ReadonlySet<number> = new Set();
/** Provider 밖(일부 테스트)에서는 아무것도 숨기지 않고 삭제도 예약하지 않는다. */
const RecordDeleteContext = createContext<RecordDeleteContextValue>({ requestDelete: () => false, hiddenIds: EMPTY });

export function useRecordDelete(): RecordDeleteContextValue {
  return useContext(RecordDeleteContext);
}

/** 기록 목록에서 삭제 대기 중인 기록을 뺀 목록. 목록을 그리는 곳은 서버가 준 배열을 이 함수를 거쳐 쓴다. */
export function useVisibleRecords(records: readonly RecordResponse[] | undefined): RecordResponse[] {
  const { hiddenIds } = useRecordDelete();
  return useMemo(() => (records ?? []).filter((record) => !hiddenIds.has(record.id)), [records, hiddenIds]);
}

interface Pending {
  record: RecordResponse;
  /** 삭제를 누른 사용자. 로그아웃·계정 전환 때 남의 계정으로 요청이 나가지 않게 가려내는 데 쓴다 */
  userId: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** 이 삭제의 토스트를 닫는다 */
  dismissToast: () => void;
  /** 서버에 요청을 보낸 뒤(응답을 기다리는 중)면 true. 이때부터는 되돌릴 수 없다 */
  sending: boolean;
}

/**
 * 본인 기록 삭제의 "되돌리기"를 앱 전체에서 맡는다 (DESIGN-UI 10장·35장).
 *
 * 왜 Provider(앱 맨 위)인가: 대기 중인 삭제를 기록 창 같은 화면 컴포넌트 상태에 두면 창이 닫히거나 다른 화면으로 가는 순간
 * 타이머가 사라져 삭제가 영영 안 보내진다. 그래서 라우트가 바뀌어도 살아 있는 이곳에 대기 목록(ref)과 타이머를 둔다.
 *
 * 흐름: 삭제 누름 -> 목록에서 숨김 + 토스트 -> (5초) -> DELETE 전송 -> 응답 -> 관련 쿼리 무효화(서열표·레이팅·진행도·세트리스트…) -> 숨김 해제.
 *  - 무효화는 서버가 삭제를 확정한 뒤에만 한다. 대기 중에 무효화하면 서버에는 아직 기록이 있어 목록이 다시 살아나기 때문이다.
 *    그래서 숨김 해제도 무효화 쿼리가 새로 받아진 뒤에 한다(그 전에 풀면 옛 목록이 잠깐 깜빡인다).
 *  - 되돌리기: 타이머만 끄고 숨김을 푼다. 서버에는 아무것도 보내지 않았으므로 되돌릴 것도 없다.
 *  - 실패(5초 뒤 요청이 오류): 숨김을 풀어 기록을 되살리고 빨강 ! 토스트 + `다시 시도`. 이미 없는 기록(404)은 삭제된 것으로 본다.
 *  - 앱을 닫기 직전(pagehide / 탭이 hidden): 대기 중인 삭제를 바로 보낸다(fetch keepalive, 기존 apiFetch 인증 흐름 그대로).
 *    토큰은 메모리에만 있어서 새 저장 방식을 만들지 않는다. 보낼 수 없으면(토큰 재발급이 안 끝났거나 네트워크 끊김) 사용자에게 알리지 않고 둔다:
 *    기록은 서버에 남아 있으므로 다음 접속 때 목록에 그대로 보이는 것이 정상 동작이다(삭제가 안 된 것이지 데이터가 깨진 것이 아니다).
 *  - 로그아웃·탈퇴·계정 전환: 아직 보내지 않은 삭제는 **취소**한다(보내지 않고 버림). 이유: 요청은 그때의 토큰으로 나가는데, 로그아웃하면
 *    토큰이 이미 지워져 보낼 수 없고, 다른 계정으로 바뀐 뒤에 보내면 남의 기록을 건드릴 수 있어서 안전한 쪽(기록 유지)을 택했다.
 *    이미 서버에 보낸 요청은 막을 수 없지만 그 결과는 새 사용자 화면에 토스트로 나오지 않는다.
 */
export function RecordDeleteProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useOptionalUser();
  const userId = user?.id ?? null;

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(EMPTY);
  const pending = useRef(new Map<number, Pending>());

  // 타이머 콜백이 항상 최신 값을 쓰도록 ref에 둔다(렌더 중이 아니라 effect에서 갱신)
  const latest = useRef({ t, toast, queryClient, userId });
  useEffect(() => {
    latest.current = { t, toast, queryClient, userId };
  });

  const setHidden = useCallback((id: number, hidden: boolean) => {
    setHiddenIds((now) => {
      if (now.has(id) === hidden) return now;
      const next = new Set(now);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** 대기 목록에서 지우고 숨김을 푼다(되돌리기·취소·실패 공통). */
  const drop = useCallback(
    (id: number) => {
      const entry = pending.current.get(id);
      if (entry?.timer) clearTimeout(entry.timer);
      pending.current.delete(id);
      setHidden(id, false);
    },
    [setHidden],
  );

  const requestRef = useRef<(record: RecordResponse) => boolean>(() => false);

  /** 서버에 삭제를 보낸다. keepalive는 앱을 닫기 직전용이다. */
  const send = useCallback(
    async (id: number, keepalive: boolean) => {
      const entry = pending.current.get(id);
      if (!entry || entry.sending) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      entry.sending = true;
      entry.dismissToast(); // 보낸 뒤에는 되돌릴 수 없으므로 `되돌리기` 토스트도 닫는다
      try {
        await deleteRecord(id, { keepalive });
      } catch (error) {
        const { t: tr, toast: show, userId: nowUser } = latest.current;
        if (!(error instanceof ApiError && error.status === 404)) {
          drop(id); // 기록을 목록에 되살린다
          if (nowUser === entry.userId) {
            show(tr("Record.deleteFailed"), {
              kind: "error",
              durationMs: 8000,
              action: { label: tr("Common.retry"), onAction: () => requestRef.current(entry.record) },
            });
          }
          return;
        }
        // 404 = 이미 없는 기록(다른 기기에서 지움). 삭제된 것으로 보고 아래에서 목록을 새로 받는다
      }
      try {
        // 확정된 뒤에만 무효화한다(서열표·레이팅·진행도·세트리스트 완료 표시가 이 응답 뒤에 바뀐다)
        await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => latest.current.queryClient.invalidateQueries({ queryKey })));
      } finally {
        drop(id);
      }
    },
    [drop],
  );

  /** 되돌리기: 타이머를 끄고 숨김을 푼다. 서버에는 아무것도 보내지 않았다. */
  const undo = useCallback(
    (id: number) => {
      const entry = pending.current.get(id);
      if (!entry || entry.sending) return; // 이미 서버에 보냈다면 되돌릴 수 없다
      entry.dismissToast();
      drop(id);
    },
    [drop],
  );

  const requestDelete = useCallback(
    (record: RecordResponse): boolean => {
      const { t: tr, toast: show, userId: nowUser } = latest.current;
      if (nowUser === null || pending.current.has(record.id)) return false;
      const dismissToast = show(tr("Record.deletedUndoable"), {
        kind: "success",
        durationMs: UNDO_WINDOW_MS,
        countdown: true,
        action: { label: tr("Record.undo"), onAction: () => undo(record.id) },
      });
      pending.current.set(record.id, {
        record,
        userId: nowUser,
        timer: setTimeout(() => void send(record.id, false), UNDO_WINDOW_MS),
        dismissToast,
        sending: false,
      });
      setHidden(record.id, true);
      return true;
    },
    [send, undo, setHidden],
  );
  useEffect(() => {
    requestRef.current = requestDelete;
  }, [requestDelete]);

  // 앱을 닫기 직전: 대기 중인 삭제를 바로 보낸다
  useEffect(() => {
    const flush = () => {
      for (const id of [...pending.current.keys()]) void send(id, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [send]);

  // 로그아웃·탈퇴·계정 전환: 보내지 않은 삭제를 취소한다
  useEffect(() => {
    for (const [id, entry] of [...pending.current]) {
      if (entry.userId !== userId && !entry.sending) {
        entry.dismissToast();
        drop(id);
      }
    }
  }, [userId, drop]);

  // Provider가 사라질 때(앱 종료·테스트)는 타이머만 정리한다
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const entry of map.values()) if (entry.timer) clearTimeout(entry.timer);
    };
  }, []);

  const value = useMemo(() => ({ requestDelete, hiddenIds }), [requestDelete, hiddenIds]);
  return <RecordDeleteContext.Provider value={value}>{children}</RecordDeleteContext.Provider>;
}
