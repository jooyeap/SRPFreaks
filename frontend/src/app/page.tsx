/** 홈 (임시). 서열표, 기록 입력, 레이팅 화면이 단계별로 이 앞에 붙는다. */
export default function Home() {
  return (
    <section className="rounded-lg border border-line bg-card p-4">
      <h1 className="font-num text-xl font-semibold">SRPFreaks</h1>
      <p className="mt-2 text-sm text-fg-sub">
        GITADORA 플레이 기록을 SRN+ 옵션으로 저장하고, 레이팅 목록을 계산합니다.
      </p>
    </section>
  );
}
