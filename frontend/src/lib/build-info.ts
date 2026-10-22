/**
 * 이 화면(프론트 이미지)이 어느 커밋으로 빌드됐는지. 배포 때 서버가 `git rev-parse --short=7 HEAD` 값을 빌드 인자(GIT_SHA)로 넘기고,
 * Dockerfile이 NEXT_PUBLIC_GIT_SHA로 코드에 고정한다. 로컬 개발·테스트처럼 값이 없으면 `dev`.
 * 쓰임: 푸터의 작은 표시, `/version`(배포 후 점검이 "방금 배포한 커밋이 실제로 떠 있는가"를 확인). 비밀값이 아니다.
 */
export const BUILD_SHA: string = process.env.NEXT_PUBLIC_GIT_SHA?.trim() || "dev";
