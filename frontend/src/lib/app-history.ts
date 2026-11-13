/**
 * "들어온 곳으로 돌아가기"를 해도 되는지(= 같은 사이트 안에 되돌아갈 화면이 있는지) 판단한다.
 *
 * 왜 필요한가: 비교 화면의 뒤로 버튼은 `router.back()`으로 들어온 화면(마이페이지 라이벌 탭, 곡 상세, 알림 등)에 돌아가고 싶다.
 * 그런데 주소창으로 직접 들어오거나 새 탭으로 연 경우 history의 이전 칸은 다른 사이트(또는 빈 탭)라서 back()이 사이트 밖으로 나가 버린다.
 * 그때는 `/players/{id}`처럼 정해 둔 곳으로 간다.
 *
 * 판단 방법(믿을 수 있는 순서):
 * 1. Navigation API가 있으면 `navigation.canGoBack`을 쓴다. 이 값은 "같은 출처의 이전 history 칸이 있는가"라서 새로고침 뒤에도 맞고,
 *    직접 진입(이전 칸이 없거나 다른 사이트)이면 false다.
 * 2. 없는 브라우저(구형 Safari·Firefox)는 앱 안에서 화면 주소(pathname)가 바뀐 횟수를 메모리에 센다(AppNavigationTracker).
 *    한 번이라도 앱 안에서 이동했으면 이전 칸이 우리 사이트다. 새로고침하면 0으로 돌아가 폴백으로 가는데, 사이트 밖으로 나가는 쪽보다 안전하다.
 *    `document.referrer`는 Next의 클라이언트 이동에서 바뀌지 않아서 쓰지 않는다. sessionStorage는 새 탭으로 복사될 수 있어 쓰지 않는다.
 * 서버에서는 호출하지 않는다(클릭 핸들러 안에서만 부른다). 어떤 접근이든 실패하면 false(= 폴백으로 이동)다.
 */

interface NavigationLike {
  canGoBack?: unknown;
}

let appNavigations = 0;

/** 앱 안에서 화면 주소가 바뀔 때마다 부른다(AppNavigationTracker). 탭·차트처럼 쿼리만 바꾸는 replace는 세지 않는다. */
export function noteAppNavigation(): void {
  appNavigations += 1;
}

/** 테스트용: 센 횟수를 비운다 */
export function resetAppHistoryForTest(): void {
  appNavigations = 0;
}

/** 같은 사이트 안에 되돌아갈 이전 화면이 있으면 true. 어떤 접근이든 실패하면 false. */
export function canGoBackInApp(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const nav = (window as Window & { navigation?: NavigationLike }).navigation;
    if (nav !== undefined && nav !== null && typeof nav.canGoBack === "boolean") {
      return nav.canGoBack;
    }
    return appNavigations > 0;
  } catch {
    return false;
  }
}

/**
 * 되돌아갈 곳이 있으면 history로 한 칸 뒤로 가고 true를 돌려준다. 없으면 아무것도 하지 않고 false(부른 쪽이 폴백 주소로 보낸다).
 * Next App Router의 `router.back()`은 `window.history.back()`과 같다(app-router-instance). 라우터 컨텍스트가 없어도 동작하도록 직접 부른다.
 */
export function goBackInApp(): boolean {
  if (!canGoBackInApp()) return false;
  try {
    window.history.back();
    return true;
  } catch {
    return false;
  }
}
