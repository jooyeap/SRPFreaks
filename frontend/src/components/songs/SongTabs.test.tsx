import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SongTabs } from "@/components/songs/SongTabs";

describe("SongTabs", () => {
  it("서열표 | 곡 목록 두 링크가 있고 현재 탭만 aria-current다", () => {
    render(<SongTabs current="songs" />);
    expect(screen.getByRole("link", { name: "서열표" })).toHaveAttribute("href", "/table");
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveAttribute("href", "/songs");
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "곡 목록" })).toHaveClass("font-bold");
    expect(screen.getByRole("link", { name: "서열표" })).not.toHaveAttribute("aria-current");
  });

  it("서열표가 현재일 때는 반대로 강조된다", () => {
    render(<SongTabs current="table" />);
    expect(screen.getByRole("link", { name: "서열표" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "곡 목록" })).not.toHaveAttribute("aria-current");
  });
});
