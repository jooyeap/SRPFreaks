import type { MetadataRoute } from "next";

/**
 * 웹 앱 매니페스트: 휴대폰 브라우저의 "홈 화면에 추가"로 앱처럼 열리게 한다(주소창 없는 전체 화면).
 * 오락실에서 한 손으로 기록을 넣을 때 브라우저를 켜고 주소를 찾는 단계를 없애려는 것이다.
 * 오프라인 캐시(서비스 워커)는 일부러 두지 않는다: 기록·레이팅은 항상 서버 값이어야 하고, 오래된 화면이 남는 사고를 피한다.
 * 색은 기본 다크 테마의 바탕(--page)과 맞춘다. 아이콘은 직접 만든 글자 아이콘이다(게임 로고·재킷은 쓰지 않는다).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SRPFreaks",
    short_name: "SRPFreaks",
    description: "GITADORA 플레이 기록을 SRN+ 옵션으로 저장하고 레이팅 목록을 계산하는 비공식 팬 프로젝트",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1218",
    theme_color: "#0f1218",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
