/**
 * "창·시트가 열려 있을 때 뒤로 가기를 누르면 창만 닫히게" 하는 history 관리자(2026-11-12). 화면 컴포넌트는 `useHistoryClose`(lib/use-history-close.ts)만 쓴다.
 *
 * 왜 필요한가: 창을 열어도 주소는 그대로라서 뒤로 가기(휴대폰 뒤로 가기 제스처 포함)를 누르면 창은 그대로 둔 채 뒤의 화면이 이동해 버린다.
 * 그래서 창이 열릴 때 같은 주소로 history 한 칸을 더 쌓고(`pushState`), 뒤로 가기가 그 한 칸을 걷어내면(`popstate`) 창을 닫는다.
 *
 * 동작 규칙
 * - 열기: 창마다 "층(layer)"을 만들어 스택에 쌓고 history에 `{ [KEY]: 층 번호 }` 한 칸을 더한다. Next App Router는 pushState를 가로채서
 *   자기 상태(__NA 등)를 새 칸에 복사해 주고 주소를 바꾸지 않으면 아무것도 하지 않으므로(app-router.js) 이 호출은 화면 이동을 일으키지 않는다.
 * - 뒤로 가기(popstate): 지금 칸이 가리키는 층보다 위에 있는 층(= 칸이 이미 사라진 층)을 위에서부터 닫는다. 창이 겹쳐 열려 있어도 한 번에 하나씩 닫힌다.
 * - 코드로 닫기(X·Esc·바깥 누르기·저장 후 닫기): 이 층의 칸이 지금 칸일 때만 `history.back()`으로 같이 걷어낸다. 그때 오는 popstate는 우리가 만든 것이라 무시한다(pendingPops).
 * - 이동하면서 닫기: 창 안에서 다른 화면으로 가는 일은 "닫기 → 이동"이 거의 동시에 일어난다. 이때 우리가 `back()`을 부르면
 *   (1) 이동이 먼저 쌓이면 back()이 새 화면을 걷어내고, (2) 이동이 느리면 back()의 복원이 진행 중인 이동을 덮어쓸 수 있다. 그래서
 *   - 코드로 부르는 이동(`router.push`·`router.replace`)은 `runAfterHistorySettled`로 감싼다: 창이 쌓은 칸을 먼저 걷어내고(popstate가 온 뒤) 이동한다.
 *     그러면 history는 창을 열기 전과 같은 모양이라 push는 한 칸만 쌓이고 replace는 원래 화면 칸을 바꾼다.
 *   - 우리가 순서를 정할 수 없는 `<Link>` 클릭은 "이동하려는 뜻"으로 감지해(내부 링크 클릭, 캡처 단계) back()을 부르지 않고 칸을 그대로 둔다(죽은 칸).
 *     일정 시간 뒤에도 그 칸이 지금 칸이면(= 이동이 일어나지 않았으면) 그때 걷어낸다.
 * - 죽은 칸: 층 없이 남은 우리 칸이다. 뒤로 가기로 거기에 닿으면 사용자 눈에는 같은 화면이므로 한 번 더 `back()`을 불러 건너뛴다(settle).
 *   새로고침하면 층 번호가 새로 시작하므로 이전 번호와 겹치지 않게 번호에 세션 표식을 붙인다.
 * - 아직 걷어내는 중(pendingPops)에 새 창이 열리면 칸 쌓기를 popstate가 끝난 뒤로 미룬다(React 개발 모드의 effect 이중 실행도 이 경우다).
 * 서버·테스트처럼 history가 없거나 실패하면 모두 조용히 아무것도 하지 않는다(창은 예전처럼 열리고 닫힌다).
 */

const KEY = "__srpLayer";
const SESSION = Math.random().toString(36).slice(2, 8);
/** 이동하려는 뜻을 감지한 뒤 이 시간 동안은 코드로 닫아도 back()을 부르지 않는다 */
const NAVIGATION_WINDOW_MS = 1500;
/** 이동하려는 뜻이 있었는데 이동이 일어나지 않으면(같은 주소 링크 등) 이 시간 뒤에 칸을 걷어낸다 */
const NAVIGATION_CLEANUP_MS = 1800;
/** popstate가 끝내 오지 않을 때 "걷어내는 중" 표시를 푸는 안전장치 */
const PENDING_FAILSAFE_MS = 1000;

export interface HistoryLayer {
  id: string;
  /** 이 층의 history 칸을 실제로 쌓았는지(쌓기를 미룬 동안은 false) */
  live: boolean;
  close: () => void;
}

const stack: HistoryLayer[] = [];
let counter = 0;
let pendingPops = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
const afterPops: Array<() => void> = [];
let navigationUntil = 0;
let listening = false;

function readKey(): string | undefined {
  try {
    const state: unknown = window.history.state;
    if (typeof state === "object" && state !== null) {
      const value = (state as Record<string, unknown>)[KEY];
      return typeof value === "string" ? value : undefined;
    }
  } catch {
    // history를 읽을 수 없으면 우리 칸이 없는 것으로 본다
  }
  return undefined;
}

function isLiveId(id: string): boolean {
  return stack.some((layer) => layer.live && layer.id === id);
}

/** back()을 부르고, 그때 오는 popstate가 우리가 만든 것임을 기억한다 */
function backOnce(): void {
  try {
    pendingPops += 1;
    if (pendingTimer !== null) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingPops = 0;
      pendingTimer = null;
      flushAfterPops();
    }, PENDING_FAILSAFE_MS);
    window.history.back();
  } catch {
    pendingPops = Math.max(0, pendingPops - 1);
  }
}

function flushAfterPops(): void {
  const queued = afterPops.splice(0);
  for (const run of queued) run();
}

/** 지금 칸이 죽은 칸(우리 칸인데 대응하는 층이 없음)이면 한 칸 더 뒤로 가서 건너뛴다 */
function settle(): void {
  const current = readKey();
  if (current !== undefined && !isLiveId(current)) {
    backOnce();
  }
}

function onPopState(): void {
  if (pendingPops > 0) {
    pendingPops -= 1;
    if (pendingPops === 0) {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      // 죽은 칸이 남았으면 먼저 한 칸 더 걷어내고(settle), 더 걷어낼 것이 없을 때 기다리던 일(칸 쌓기·화면 이동)을 한다
      settle();
      if (pendingPops === 0) flushAfterPops();
    }
    return;
  }
  const current = readKey();
  // 위에서부터: 지금 칸이 가리키는 층에 닿을 때까지, 칸이 사라진 층을 닫는다(겹친 창은 하나씩)
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const layer = stack[i];
    if (layer === undefined || !layer.live) continue;
    if (layer.id === current) break;
    stack.splice(i, 1);
    layer.live = false;
    layer.close();
  }
  settle();
}

/** 같은 사이트 안으로 가는 링크를 누르면 "이동하려는 뜻"으로 본다(창 바깥을 눌러 닫는 도움말 상자 등에서 링크를 바로 누르는 경우) */
function onClickCapture(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.target !== "" && anchor.target !== "_self") return;
  if (anchor.origin !== window.location.origin) return;
  noteNavigationIntent();
}

function ensureListening(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPopState);
  document.addEventListener("click", onClickCapture, true);
}

/** 곧 다른 화면으로 이동한다는 것을 기억한다. 이 시간 안에 창이 닫히면 history를 되돌리지 않고, 이동이 일어나지 않았으면 나중에 걷어낸다. */
function noteNavigationIntent(): void {
  navigationUntil = Date.now() + NAVIGATION_WINDOW_MS;
}

/**
 * 창을 닫으면서 `router.push`·`router.replace`로 다른 화면에 갈 때 이동 코드를 이 함수로 감싼다.
 * 창이 쌓아 둔 history 칸을 걷어내는 popstate가 끝난 뒤에 실행해서, 이동이 칸 정리와 겹치지 않게 한다(머리말 참고).
 * 한 틱 미루는 이유: 같은 클릭 안에서 "창 닫기" 상태 변경이 화면에 반영되어 닫기 정리(closeLayer)가 실행된 뒤에 걷어내는 중인지 봐야 하기 때문이다.
 * 걷어낼 칸이 없으면(창이 없었거나 쌓기 전) 바로 실행한다.
 */
export function runAfterHistorySettled(run: () => void): void {
  setTimeout(() => {
    if (pendingPops > 0) {
      afterPops.push(run);
    } else {
      run();
    }
  }, 0);
}

function writeEntry(layer: HistoryLayer): void {
  if (!stack.includes(layer)) return; // 쌓기를 기다리는 동안 이미 닫힌 층
  try {
    window.history.pushState({ [KEY]: layer.id }, "");
    layer.live = true;
  } catch {
    // pushState를 못 쓰면 뒤로 가기 닫기만 빠지고 창은 정상 동작한다
  }
}

/** 창이 열릴 때 부른다. 닫힐 때는 돌려받은 층을 `closeLayer`에 넘긴다. */
export function openLayer(close: () => void): HistoryLayer {
  ensureListening();
  counter += 1;
  const layer: HistoryLayer = { id: `${SESSION}-${counter}`, live: false, close };
  stack.push(layer);
  if (pendingPops > 0) {
    afterPops.push(() => writeEntry(layer));
  } else {
    writeEntry(layer);
  }
  return layer;
}

/** 코드로(X·Esc·바깥 누르기·저장 후) 창을 닫을 때 부른다. 뒤로 가기가 이미 닫은 층이면 아무것도 하지 않는다. */
export function closeLayer(layer: HistoryLayer): void {
  const index = stack.indexOf(layer);
  if (index < 0) return; // 뒤로 가기(popstate)가 이미 처리했다
  stack.splice(index, 1);
  if (!layer.live) return;
  layer.live = false;
  // 이 층의 칸이 지금 칸이 아니면(이미 이동했거나 아래 층이 먼저 닫힘) 걷어낼 수 없다. 남은 칸은 죽은 칸이 되어 뒤로 가기 때 건너뛴다.
  if (readKey() !== layer.id) return;
  if (Date.now() < navigationUntil) {
    setTimeout(() => {
      if (readKey() === layer.id) backOnce();
    }, NAVIGATION_CLEANUP_MS);
    return;
  }
  backOnce();
}

/** 테스트용: 관리자 상태를 처음으로 되돌린다 */
export function resetHistoryLayersForTest(): void {
  stack.splice(0);
  afterPops.splice(0);
  pendingPops = 0;
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  navigationUntil = 0;
  counter = 0;
}
