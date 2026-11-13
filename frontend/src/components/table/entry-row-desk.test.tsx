import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ko from "../../../messages/ko.json";
import { EntryRow, TableHeadRow } from "@/components/table/EntryRow";
import type { TableEntryResponse } from "@/lib/api-types";

const base: TableEntryResponse = {
  entryId: 1, songDifficultyId: 10, songId: 100, title: "MIND ERUPTION", addedVersion: "V1", part: "BASS", difficulty: "MASTER",
  level: 9.05, tierUncertain: false, recommend: "중", recommendUncertain: false, pattern: "단일", patternUncertain: false,
  ratingEnabled: true, mine: { rate: 100, fullCombo: true, stage: "EXC" },
};

function renderRow(entry: TableEntryResponse, onRecord?: () => void, showRecord = true) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <TableHeadRow showRecord={showRecord} />
      <ul><EntryRow entry={entry} tier={5.0} onRecord={onRecord} showRecord={showRecord} /></ul>
    </NextIntlClientProvider>,
  );
}

describe("데스크톱 서열표 줄 (2026-11-01)", () => {
  it("머리 행은 곡명 · 채보 · 속성 · 추천 · 랭크·달성률 · 점수 순서", () => {
    const { container } = renderRow(base);
    const head = container.firstElementChild;
    expect(head?.children).toHaveLength(7);
    expect(head).toHaveTextContent("곡명채보속성추천랭크 · 달성률점수");
  });

  it("기록이 있으면 막대·[EXC | MAX] 알약·점수, 기록 버튼은 +", () => {
    renderRow(base, () => {});
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("h-14");
    expect(row.querySelector(".stage-bar")).not.toBeNull();
    expect(within(row).getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
    expect(row).toHaveTextContent("MAX");
    expect(within(row).getByRole("button", { name: "MIND ERUPTION 기록 입력" })).toHaveTextContent("+");
  });

  it("기록이 없으면 막대 없이 [– | –]", () => {
    renderRow({ ...base, mine: null });
    const row = screen.getByRole("listitem");
    expect(row.querySelector(".stage-bar")).toBeNull();
    expect(row).toHaveTextContent("––");
  });
});

describe("데스크톱 서열표 줄 전체 누르기 (2026-11-12)", () => {
  it("줄에 링크는 곡명 하나뿐이고, 그 링크가 줄 전체로 펼쳐진 덮개(::after inset-0)를 갖는다", () => {
    renderRow(base, () => {});
    const row = screen.getByRole("listitem");
    const links = within(row).getAllByRole("link");
    expect(links).toHaveLength(1); // 줄 하나 = 링크 하나(키보드 탭·화면 읽기에서 중복 없음)
    expect(links[0]).toHaveAttribute("href", expect.stringMatching(/^\/songs\/100/));
    expect(links[0]).toHaveTextContent("MIND ERUPTION");
    expect(links[0]).toHaveClass("after:absolute", "after:inset-0");
    expect(links[0].className).toContain("focus-visible:after:outline"); // 포커스 링은 줄 전체(덮개)에
    expect(links[0]).toHaveClass("focus-visible:outline-none"); // 링크 글자의 기본 윤곽선은 꺼서 포커스가 이중으로 보이지 않는다
    // 덮개의 기준은 줄이다: 줄은 relative, 링크는 위치 기준이 아니다(그래야 truncate에 잘리지 않고 줄 전체를 덮는다)
    expect(row).toHaveClass("relative");
    expect(links[0]).not.toHaveClass("relative");
  });

  it("마우스를 올리면 줄이 밝아진다(hover 배경)", () => {
    renderRow(base);
    expect(screen.getByRole("listitem").className).toContain("hover:bg-table-head");
  });

  it("안쪽 버튼(+ 와 점수 칩)은 줄 덮개보다 위에 그려져 따로 눌린다", () => {
    const onRecord = vi.fn();
    renderRow(base, onRecord);
    const row = screen.getByRole("listitem");
    const plus = within(row).getByRole("button", { name: "MIND ERUPTION 기록 입력" });
    expect(plus).toHaveClass("relative");
    fireEvent.click(plus);
    expect(onRecord).toHaveBeenCalledTimes(1);
    // 점수 칩 버튼도 위치 기준(relative)이라 덮개 뒤에 그려지지 않는다
    expect(within(row).getByRole("button", { name: "MIND ERUPTION 기록 수정" })).toHaveClass("relative");
  });
});

describe("내 기록 칸이 없는 줄·머리 (비로그인 폴더, 2026-11-12)", () => {
  it("showRecord=false면 머리는 4칸(곡명·채보·속성·추천), 줄에는 알약·점수·+ 버튼이 없다", () => {
    const { container } = renderRow(base, () => {}, false);
    const head = container.firstElementChild;
    expect(head?.children).toHaveLength(4);
    expect(head).toHaveTextContent("곡명채보속성추천");
    expect(head).not.toHaveTextContent("달성률");
    const row = screen.getByRole("listitem");
    expect(within(row).queryByLabelText("달성 단계 EXC")).toBeNull();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(row).not.toHaveTextContent("MAX");
    expect(row.className).toContain("md:grid-cols-[minmax(0,1fr)_190px_52px_44px]");
    expect(row.className).not.toContain("72px_64px_32px");
  });

  it("기록이 없는 줄도 `– –` 알약을 그리지 않는다", () => {
    renderRow({ ...base, mine: null }, undefined, false);
    expect(screen.getByRole("listitem")).not.toHaveTextContent("––");
  });
});
