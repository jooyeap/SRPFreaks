import { useEffect } from "react";

/**
 * 화면 꺼짐 방지(Screen Wake Lock). 기록 창이 열려 있는 동안만 건다: 게임 사이사이에 휴대폰을 들고 달성률을 옮겨 적는 동안
 * 화면이 꺼져 다시 켜야 하는 불편을 줄이려는 것이다. 창을 닫거나 화면에서 벗어나면(탭 전환) 바로 놓아서 배터리를 아낀다.
 * 지원하지 않는 브라우저에서는 아무 일도 하지 않는다. 실패해도(배터리 절약 모드 등) 조용히 넘어간다: 없어도 기능은 그대로다.
 * 브라우저는 다른 탭으로 갔다 오면 잠금을 자동으로 풀어서, 화면이 다시 보일 때(visibilitychange) 다시 건다.
 */
interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!active || !api) {
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        const next = await api!.request("screen");
        if (cancelled) {
          void next.release();
        } else {
          sentinel = next;
        }
      } catch {
        // 허용되지 않았거나 배터리 절약 모드: 없어도 동작한다
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    }
    // 잠금이 브라우저에 의해 풀렸을 수 있으므로(화면 숨김) 숨겨질 때 참조를 비워 둔다
    function onHidden() {
      if (document.visibilityState === "hidden") {
        sentinel = null;
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("visibilitychange", onHidden);
      void sentinel?.release();
      sentinel = null;
    };
  }, [active]);
}
