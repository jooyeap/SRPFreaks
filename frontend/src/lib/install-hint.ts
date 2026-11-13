/**
 * 홈 화면 추가 안내(D73)에 쓰는 판정과 "이미 닫았는지" 저장.
 * localStorage는 사용자별 편의로만 쓴다: 값은 불리언 하나("1")뿐이고 토큰 같은 민감값은 넣지 않는다.
 * 읽기·쓰기가 막혀도(사생활 보호 창 등) 앱은 정상이고, 그때는 메모리에 닫음을 기억해서 이번 방문 동안은 다시 뜨지 않는다.
 */
const KEY = "srp.installHintSeen";
let dismissedInMemory = false;

export function isInstallHintDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallHint(): void {
  dismissedInMemory = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // 저장하지 못해도 메모리 값으로 이번 방문 동안은 다시 뜨지 않는다
  }
}

/** 테스트용 */
export function resetInstallHintForTest(): void {
  dismissedInMemory = false;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

/** 브라우저 안에서 열었는지(other), 이미 홈 화면 앱으로 열었는지(standalone), iPhone/iPad의 Safari인지(ios-safari). */
export type InstallEnv = "standalone" | "ios-safari" | "other";

/**
 * iPhone/iPad의 Safari인지. iPadOS 13+는 UA가 Mac으로 오므로 "Mac + 터치점 2개 이상"도 iOS로 본다.
 * iOS의 다른 브라우저(Chrome·Firefox·Edge·Opera)와 앱 안 브라우저(Google 앱·Facebook·Instagram·Line)는 제외한다:
 * 홈 화면에 추가하는 방법이 달라서 "Safari 공유 버튼" 안내가 맞지 않는다.
 */
export function isIosSafari(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (!ios) return false;
  return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\//.test(userAgent);
}

type StandaloneNavigator = Navigator & { standalone?: boolean };

/** 이미 홈 화면 앱(standalone)으로 열렸는지. iOS는 navigator.standalone, 나머지는 display-mode 미디어 쿼리다. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if ((navigator as StandaloneNavigator).standalone === true) return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

export function readInstallEnv(): InstallEnv {
  if (typeof window === "undefined") return "other";
  if (isStandaloneDisplay()) return "standalone";
  return isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) ? "ios-safari" : "other";
}

/** Android(Chromium)가 설치 가능할 때 보내는 이벤트. 표준 타입에 없어서 필요한 부분만 적는다. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
