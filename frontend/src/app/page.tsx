import Link from "next/link";

/** 홈. 서비스 소개와 주요 화면으로 가는 길. 모든 화면은 로그인이 필요하며, 로그인하지 않았으면 각 화면이 로그인 안내를 보여 준다. */
const SHORTCUTS = [
  {
    href: "/table",
    title: "서열표",
    description: "기준 난이도별로 채보를 보고, 내 기록과 달성 현황을 확인합니다. 줄의 기록 버튼으로 기록을 입력합니다.",
  },
  {
    href: "/rating",
    title: "레이팅",
    description: "SRN+ 기록으로 계산한 레이팅 합계와 플레이어 티어, 단일 15·그 외 25 목록을 확인합니다.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4">
        <h1 className="font-num text-xl font-semibold">SRPFreaks</h1>
        <p className="mt-2 text-sm text-fg-sub">
          GITADORA 플레이 기록을 SRN+ 옵션으로 저장하고, 레이팅 목록을 계산합니다.
        </p>
        <p className="mt-2 text-xs text-fg-dim">로그인은 Google 계정으로만 합니다. 기록은 직접 입력하며, 본인만 볼 수 있습니다.</p>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full flex-col gap-1 rounded-lg border border-line bg-card p-4 hover:bg-table-head"
            >
              <span className="text-base font-semibold text-fg">{item.title}</span>
              <span className="text-sm text-fg-sub">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
