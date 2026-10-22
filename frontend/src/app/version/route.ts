import { BUILD_SHA } from "@/lib/build-info";

/**
 * 배포 확인용: 지금 떠 있는 프론트가 어느 커밋으로 빌드됐는지 돌려준다 (로그인 불필요, 비밀값 아님).
 * 배포 워크플로가 방금 배포한 커밋과 비교해, "배포는 성공인데 옛 화면"인 상황을 실패로 잡는다.
 * 캐시되면 옛 값이 보여 확인이 의미 없으므로 no-store로 내려 준다.
 */
export function GET(): Response {
  return Response.json({ sha: BUILD_SHA }, { headers: { "Cache-Control": "no-store" } });
}
