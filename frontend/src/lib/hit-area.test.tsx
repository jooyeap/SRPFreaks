import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactLine } from "@/components/ContactLine";
import { TableCredit } from "@/components/TableCredit";
import { SiteFooter } from "@/components/SiteFooter";
import { RatedScore } from "@/components/table/RatedScore";
import { ChartLine } from "@/components/table/ChartLine";
import { FOOTER_LINE_LINK, HIT_BASE, HIT_CHIP, HIT_HEAD, HIT_ROW, HIT_STANDALONE, HIT_SUMMARY, HIT_TITLE } from "@/lib/hit-area";
import type { TableEntryResponse } from "@/lib/api-types";

/** 상수의 클래스 글자를 낱개로 나눈 목록(toHaveClass에 그대로 넘긴다) */
function tokens(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

describe("누르는 영역 44px 공통 방식 (hit-area)", () => {
  it("모든 변형이 같은 기본 클래스(relative + 투명 ::after)를 품는다", () => {
    for (const v of [HIT_TITLE, HIT_CHIP, HIT_HEAD, HIT_ROW, HIT_STANDALONE, HIT_SUMMARY]) {
      for (const base of tokens(HIT_BASE)) expect(tokens(v)).toContain(base);
    }
  });

  it("곡명 링크는 위아래로만 넓히고 좌우는 링크 폭 그대로다(오른쪽 열·재킷을 침범하지 않는다)", () => {
    const t = tokens(HIT_TITLE);
    expect(t).toContain("after:inset-x-0");
    expect(t).toContain("after:-inset-y-[13px]");
    expect(t.some((c) => c.startsWith("after:-inset-x"))).toBe(false);
  });

  it("점수 칩은 오른쪽을 4px에서 멈춘다(`+` 버튼 영역과 겹치지 않는다)", () => {
    expect(tokens(HIT_CHIP)).toContain("after:-right-1");
  });

  it("머리 링크는 아래쪽을 6px에서 멈춘다(아래 목록과 겹치지 않는다)", () => {
    expect(tokens(HIT_HEAD)).toContain("after:-bottom-1.5");
  });

  it("접힘 줄은 열렸을 때 아래로 8px만 넓힌다(아래 목록과 닿기 전에 멈춘다)", () => {
    expect(HIT_SUMMARY).toContain("[details[open]>&]:after:-bottom-2");
  });
});

describe("누르는 영역이 대상 링크에 적용됨", () => {
  it("공통 곡 줄의 곡명 링크: href·이름은 그대로, 누르는 영역 클래스와 안쪽 말줄임 칸", () => {
    render(
      <ul>
        <ChartLine jacket={null} pattern="단일" title="테스트 곡" href="/songs/1" part="GUITAR" difficulty="MASTER" level={9.5} />
      </ul>,
    );
    const link = screen.getByRole("link", { name: "테스트 곡" });
    expect(link).toHaveAttribute("href", "/songs/1");
    expect(link).toHaveClass(...tokens(HIT_TITLE));
    expect(link.querySelector("span")).toHaveClass("block", "truncate");
  });

  it("서열표 줄 `기록 수정` 버튼: 이름은 그대로, 누르는 영역 클래스", () => {
    const entry = {
      entryId: 1, songDifficultyId: 1, songId: 1, title: "테스트 곡", addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9.5,
      tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true,
      mine: { rate: 95.17, stage: "SS", fullCombo: false },
    } as unknown as TableEntryResponse;
    render(<RatedScore entry={entry} tier={5.6} onRecord={() => undefined} />);
    const button = screen.getByRole("button", { name: "테스트 곡 기록 수정" });
    expect(button).toHaveClass(...tokens(HIT_CHIP));
  });
});

describe("푸터 링크", () => {
  it("이용약관·개인정보 처리방침 링크는 높이 44px 줄이고 href는 그대로다", () => {
    render(<SiteFooter />);
    for (const [name, href] of [["이용약관", "/terms"], ["개인정보 처리방침", "/privacy"]] as const) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveClass(...tokens(FOOTER_LINE_LINK));
    }
  });

  it("서열표 제공자 링크는 `tall`일 때만 44px 줄이다", () => {
    const { rerender } = render(<TableCredit />);
    const link = screen.getByRole("link");
    expect(link.className).not.toContain("min-h-11");
    rerender(<TableCredit tall />);
    expect(screen.getByRole("link")).toHaveClass(...tokens(FOOTER_LINE_LINK));
  });

  it("문의 이메일 링크는 `tall`일 때만 44px 줄이다(처리방침 본문의 글 속 링크는 그대로)", () => {
    const { rerender, container } = render(<ContactLine />);
    const first = container.querySelector("a");
    if (first) {
      expect(first.className).not.toContain("min-h-11");
      rerender(<ContactLine tall />);
      expect(container.querySelector("a")).toHaveClass(...tokens(FOOTER_LINE_LINK));
    } else {
      // 문의 메일이 설정되지 않은 환경에서는 아무것도 그리지 않는다(기존 동작)
      expect(container).toBeEmptyDOMElement();
    }
  });
});

describe("푸터 링크: 손가락은 44px 줄, 마우스는 글자 범위만 (2026-11-12)", () => {
  it("FOOTER_LINE_LINK의 44px 줄 클래스는 모두 손가락 기기(pointer-coarse)에만 걸려 있어, 마우스 기기는 보통 inline 링크다", () => {
    const set = tokens(FOOTER_LINE_LINK);
    expect(set).toEqual(["pointer-coarse:inline-flex", "pointer-coarse:min-h-11", "pointer-coarse:items-center"]);
    // 조건 없는 min-h-11·inline-flex가 있으면 마우스 기기에서도 44px(36px) 줄이 된다
    expect(set.every((token) => token.startsWith("pointer-coarse:"))).toBe(true);
  });

  it("푸터의 네 링크(제공자·문의 이메일·약관·처리방침)가 모두 같은 클래스를 쓴다", () => {
    const { container } = render(<SiteFooter />);
    const links = Array.from(container.querySelectorAll("footer a"));
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      expect(link).toHaveClass("pointer-coarse:inline-flex", "pointer-coarse:min-h-11");
      expect(link.className).not.toMatch(/(^| )min-h-11( |$)/); // 조건 없는 min-h-11이 없다(마우스 기기는 글자 범위만)
    }
  });

  it("푸터는 아래 고정 바 높이(--bottom-bar-h)만큼 아래를 비우고, 맨 위로 버튼 자리를 위해 오른쪽 여백을 넓힌다", () => {
    const { container } = render(<SiteFooter />);
    const footer = container.querySelector("footer");
    expect(footer).toHaveClass("pb-[var(--bottom-bar-h,0px)]");
    expect(footer?.firstElementChild).toHaveClass("sm:max-[1340px]:pr-16");
  });
});

describe("공통 방식을 쓰는 화면 목록(빠뜨림 방지)", () => {
  // 렌더에 데이터·로그인이 많이 필요한 화면은 소스에서 공통 상수를 쓰는지만 확인한다.
  const TARGETS: Array<[string, string]> = [
    ["src/components/table/ChartLine.tsx", "HIT_TITLE"],
    ["src/components/table/RatedScore.tsx", "HIT_CHIP"],
    ["src/components/rivals/RivalRecordsCard.tsx", "HIT_ROW"],
    ["src/components/song/TableContext.tsx", "HIT_HEAD"],
    ["src/components/song/TableContext.tsx", "HIT_SUMMARY"],
    ["src/components/home/ProgressCard.tsx", "HIT_HEAD"],
    ["src/components/home/HomeNotices.tsx", "HIT_HEAD"],
    ["src/components/home/PlayersPreview.tsx", "HIT_HEAD"],
    ["src/components/SiteFooter.tsx", "FOOTER_LINE_LINK"],
    ["src/components/recognize/PhotoInputView.tsx", "HIT_STANDALONE"],
    ["src/app/settings/withdraw/page.tsx", "HIT_STANDALONE"],
  ];
  for (const [file, name] of TARGETS) {
    it(`${file}은 ${name}을 쓴다`, async () => {
      const { readFileSync } = await import("node:fs");
      const source = readFileSync(file, "utf8");
      expect(source).toContain(name);
      expect(source).toContain('from "@/lib/hit-area"');
    });
  }
});
