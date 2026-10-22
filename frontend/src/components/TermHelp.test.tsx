import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermHelp } from "@/components/TermHelp";

describe("TermHelp", () => {
  it("처음에는 ? 버튼만 있고, 누르면 설명과 설명서 링크가 열린다", () => {
    render(<TermHelp term="single" label="단일" />);
    const button = screen.getByRole("button", { name: "단일 설명 보기" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("dialog", { name: "단일 설명" });
    expect(panel).toHaveTextContent("단일이란?");
    expect(screen.getByRole("link", { name: "설명서에서 자세히 보기" })).toHaveAttribute("href", "/guide");
    expect(button).toHaveAttribute("aria-controls", panel.id);
  });

  it("말풍선은 부모의 줄바꿈 금지(nowrap)를 물려받지 않게 해서, 글자가 말풍선 밖으로 튀어나가지 않는다", () => {
    // 라벨(dt)이 whitespace-nowrap이어도 안의 설명은 줄이 바뀌어야 한다 (2026-10-20: 모바일에서 설명이 화면 밖으로 잘렸다)
    render(
      <dt className="whitespace-nowrap">
        <TermHelp term="ratingConstant" label="레이팅 상수 난이도" />
      </dt>,
    );
    fireEvent.click(screen.getByRole("button", { name: "레이팅 상수 난이도 설명 보기" }));
    expect(screen.getByRole("dialog", { name: "레이팅 상수 난이도 설명" })).toHaveClass("whitespace-normal");
  });

  it("눈에 보이는 ?는 장식이라 버튼 이름에 들어가지 않는다", () => {
    render(<TermHelp term="ratingConstant" label="레이팅 상수 난이도" />);
    expect(screen.getByRole("button", { name: "레이팅 상수 난이도 설명 보기" })).toBeInTheDocument();
  });

  it("버튼을 다시 누르거나 바깥을 누르거나 Esc를 누르면 닫히고, Esc는 포커스를 버튼으로 돌린다", () => {
    render(
      <div>
        <TermHelp term="other" label="복합·이중·삼중" />
        <p>바깥</p>
      </div>,
    );
    const button = screen.getByRole("button", { name: "복합·이중·삼중 설명 보기" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText("바깥"));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("말풍선 안을 눌러도 닫히지 않는다", () => {
    render(<TermHelp term="single" label="단일" />);
    fireEvent.click(screen.getByRole("button", { name: "단일 설명 보기" }));
    fireEvent.pointerDown(screen.getByText("단일이란?"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
