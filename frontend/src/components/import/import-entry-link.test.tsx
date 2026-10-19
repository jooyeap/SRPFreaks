import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImportEntryLink } from "@/components/import/ImportEntryLink";

describe("최근 플레이 가져오기 바로가기", () => {
  it("/import로 연결한다", () => {
    render(<ImportEntryLink />);
    expect(screen.getByRole("link", { name: /최근 플레이 가져오기/ })).toHaveAttribute("href", "/import");
  });
});
