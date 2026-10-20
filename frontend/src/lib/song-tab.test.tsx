import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SONG_TAB_KEY, rememberSongTab, resetSongTabForTest, useSongHomeHref } from "@/lib/song-tab";

function Href() {
  return <p>{useSongHomeHref()}</p>;
}

describe("song-tab", () => {
  beforeEach(() => {
    localStorage.removeItem(SONG_TAB_KEY);
    resetSongTabForTest();
  });

  it("기억이 없으면 서열표로 간다", () => {
    render(<Href />);
    expect(screen.getByText("/table")).toBeInTheDocument();
  });

  it("마지막으로 본 탭을 기억하고 화면이 바로 바뀐다", () => {
    render(<Href />);
    act(() => rememberSongTab("songs"));
    expect(screen.getByText("/songs")).toBeInTheDocument();
    expect(localStorage.getItem(SONG_TAB_KEY)).toBe("songs");
    act(() => rememberSongTab("table"));
    expect(screen.getByText("/table")).toBeInTheDocument();
  });

  it("저장소에 이상한 값이 있어도 두 탭 중 하나(기본 서열표)만 쓴다", () => {
    localStorage.setItem(SONG_TAB_KEY, "https://evil.example");
    resetSongTabForTest();
    render(<Href />);
    expect(screen.getByText("/table")).toBeInTheDocument();
  });

  it("저장된 곡 목록 탭을 다음 방문에서 읽는다", () => {
    localStorage.setItem(SONG_TAB_KEY, "songs");
    resetSongTabForTest();
    render(<Href />);
    expect(screen.getByText("/songs")).toBeInTheDocument();
  });
});
