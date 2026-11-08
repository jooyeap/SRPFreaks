import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";

// 공용 setup은 한국어 번역을 끼우므로, 이 파일에서만 번역기를 locale에 따라 바꾼다.
const state = vi.hoisted(() => ({ locale: "ja" as "ja" | "ko" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { TierGroupSection } from "@/components/table/TierGroupSection";
import type { TierGroupResponse } from "@/lib/api-types";

const group: TierGroupResponse = { tier: 5.8, total: 50, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, recorded: 0, averageRecorded: null, averageWithZero: 0, entries: [] };

describe("묶음 머리의 곡 수", () => {
  it("접히지 않는 묶음(폴더 화면)도 일본어에서는 번역된 문구로 보인다", () => {
    state.locale = "ja";
    render(<TierGroupSection group={group} includeZero={false} />);
    expect(screen.getByText("50譜面")).toBeInTheDocument();
    expect(screen.queryByText(/개/)).not.toBeInTheDocument();
  });

  it("한국어는 기존 표기(50개)를 유지한다", () => {
    state.locale = "ko";
    render(<TierGroupSection group={group} includeZero={false} />);
    expect(screen.getByText("50개")).toBeInTheDocument();
  });
});
