/**
 * Google 로그인(Google Identity Services) 스크립트 로더와 필요한 만큼의 타입.
 *
 * 구글은 타입 정의를 따로 주지 않으므로 우리가 쓰는 부분만 직접 선언한다(any 사용 금지 규칙).
 * 로그인은 "구글이 발급한 ID 토큰을 서버로 보내 서버가 검증"하는 방식이다. 이 토큰을 화면에서 믿거나 해석하지 않는다.
 */

export interface GoogleCredentialResponse {
  /** 구글이 서명한 ID 토큰(JWT). 서버가 서명·대상(client id)·만료를 검증한다. */
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
}

interface GoogleButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill";
  locale?: string;
  width?: number;
}

export interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  /** 구글 계정 자동 선택 상태를 끈다(로그아웃 직후 자동 재로그인 방지) */
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

let loadPromise: Promise<GoogleAccountsId> | null = null;

/** 스크립트를 한 번만 불러온다. 실패하면 다음에 다시 시도할 수 있게 캐시를 비운다. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저에서만 사용할 수 있습니다."));
  }
  if (window.google?.accounts.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (!loadPromise) {
    loadPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const id = window.google?.accounts.id;
        if (id) {
          resolve(id);
        } else {
          reject(new Error("구글 로그인을 불러오지 못했습니다."));
        }
      };
      script.onerror = () => reject(new Error("구글 로그인을 불러오지 못했습니다."));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}
