import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GuidePage from "@/app/guide/page";

describe("레이팅 설명서", () => {
  it("한눈에 보기 세 가지와 포함 기준 문구를 보여 준다", () => {
    render(<GuidePage />);
    expect(screen.getByRole("heading", { level: 1, name: "레이팅 설명서" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "한눈에 보기" });
    expect(within(summary).getByText("SRN+")).toBeInTheDocument();
    expect(within(summary).getByText("40채보")).toBeInTheDocument();
    expect(within(summary).getByText("티어")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "포함되는 채보" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "포함되지 않는 채보" })).toBeInTheDocument();
    expect(screen.getByText("속성이 단일, 복합, 이중, 삼중 중 하나인 채보")).toBeInTheDocument();
    expect(screen.getByText("제외된 채보도 기록은 그대로 남습니다.")).toBeInTheDocument();
  });

  it("상수표는 7.0~4.9의 22행이고 값이 글자로 들어 있다", () => {
    render(<GuidePage />);
    const table = screen.getByRole("table", { name: /레이팅 상수표/ });
    const bodyRows = within(table).getAllByRole("row").slice(1); // 첫 행은 머리글
    expect(bodyRows).toHaveLength(22);
    expect(within(bodyRows[0]).getByRole("rowheader")).toHaveTextContent("7.0");
    expect(within(bodyRows[21]).getByRole("rowheader")).toHaveTextContent("4.9");
    // 6.0 행: R=15, 90% -> 283 (14.1333×20 = 282.67 반올림), 95% -> 304
    const row60 = bodyRows.find((r) => within(r).getByRole("rowheader").textContent === "6.0");
    expect(row60).toBeDefined();
    const cells = within(row60 as HTMLElement).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("15"); // 내부 상수
    expect(cells[5]).toHaveTextContent("283");
    expect(cells[6]).toHaveTextContent("304");
  });

  it("칸마다 점수에 맞는 플레이어 티어 색(data-tier)이 붙고, 최고 티어를 넘으면 빛 단계(data-glow)가 붙는다", () => {
    render(<GuidePage />);
    const table = screen.getByRole("table", { name: /레이팅 상수표/ });
    const rows = within(table).getAllByRole("row");
    const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell").slice(1); // 첫 칸은 내부 상수
    const bodyRows = rows.slice(1); // 첫 행은 머리글
    const top = cellsOf(rows[1]); // 7.0 행: 70% ... 95%
    const topRight = top[top.length - 1]; // 7.0, 95% = 384 -> 하수봉, 가장 강한 빛
    expect(topRight).toHaveTextContent("384");
    expect(topRight).toHaveAttribute("data-tier", "HASUBONG");
    expect(topRight).toHaveAttribute("data-glow", "3");
    // 6.0 행 95% = 304 -> 하수봉, 강한 빛(300 이상) / 6.0 행 80% = 240 -> 하수봉, 약한 빛
    const row60 = bodyRows.find((r) => within(r).getByRole("rowheader").textContent === "6.0") as HTMLElement;
    const c60 = cellsOf(row60);
    expect(c60[5]).toHaveAttribute("data-glow", "2");
    expect(c60[2]).toHaveTextContent("240");
    expect(c60[2]).toHaveAttribute("data-glow", "1");
    // 5.5 행: 80% = 160 -> Red(빛 없음), 5.0 행 80% = 80 -> Green
    const row55 = bodyRows.find((r) => within(r).getByRole("rowheader").textContent === "5.5") as HTMLElement;
    expect(cellsOf(row55)[2]).toHaveAttribute("data-tier", "RED");
    expect(cellsOf(row55)[2]).not.toHaveAttribute("data-glow");
    const row50 = bodyRows.find((r) => within(r).getByRole("rowheader").textContent === "5.0") as HTMLElement;
    expect(cellsOf(row50)[2]).toHaveAttribute("data-tier", "GREEN");
  });

  it("색 기준 범례에 20개 티어의 곡 점수 기준이 글자로 있다 (하수봉 237.5)", () => {
    render(<GuidePage />);
    expect(screen.getByText("237.5~")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("하수봉")).toBeInTheDocument();
  });

  it("부정한 기록은 운영자가 삭제할 수 있다는 안내를 보여 준다", () => {
    render(<GuidePage />);
    expect(screen.getByRole("heading", { name: "기록 관리" })).toBeInTheDocument();
    expect(screen.getByText("부정한 방법으로 입력한 기록은 운영자가 삭제할 수 있습니다.")).toBeInTheDocument();
  });

  it("곡별 레이팅의 최고 수치는 100%가 아니라 95%라고 알려 주고, 마지막 문장은 현재 계수 기준이라고 쓴다", () => {
    render(<GuidePage />);
    expect(screen.getByText(/100%가 아니라 95%/)).toBeInTheDocument();
    expect(screen.getByText(/95%를 넘어도 점수는 더 오르지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/이 표는 현재 계수를 기준으로 계산한 값입니다/)).toBeInTheDocument();
    expect(screen.queryByText(/운영 설정값/)).not.toBeInTheDocument();
  });

  it("참고사항으로 달성률 1%의 점수를 알려 준다", () => {
    render(<GuidePage />);
    expect(screen.getByRole("heading", { name: "참고: 달성률 1%의 점수" })).toBeInTheDocument();
    expect(screen.getByText("4.27점")).toBeInTheDocument();
    expect(screen.getByText(/상수 20인 곡은 1%마다 정확히 4점/)).toBeInTheDocument();
  });
});
