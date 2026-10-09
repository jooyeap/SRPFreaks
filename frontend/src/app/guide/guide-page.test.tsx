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

  it("칸마다 점수에 맞는 배경색이 붙고, 가장 높은 칸(384)은 어두운 색에 흰 글자다", () => {
    render(<GuidePage />);
    const table = screen.getByRole("table", { name: /레이팅 상수표/ });
    const first = within(within(table).getAllByRole("row")[1]).getAllByRole("cell"); // 7.0 행
    const top = first[first.length - 1]; // 7.0, 95% = 384
    expect(top).toHaveTextContent("384");
    expect(top).toHaveStyle({ backgroundColor: "rgb(30, 20, 30)", color: "rgb(255, 255, 255)" });
  });
});
