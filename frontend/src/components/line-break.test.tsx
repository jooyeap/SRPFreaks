import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ko from "../../messages/ko.json";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RivalGuide } from "@/components/guide/RivalGuide";
import { TableTip } from "@/components/table/TableTip";
import { PatternFromGridBar } from "@/components/table/PatternFromGridBar";
import { PeerReason } from "@/components/setlist/PeerReason";
import { vi } from "vitest";

/**
 * 한국어 긴 안내 문구는 단어 중간에서 끊기지 않게 `break-keep`(word-break: keep-all)을 쓴다.
 * 전역 CSS로 걸면 칩·표 칸·닉네임이 넘칠 수 있어서, 긴 안내 문구를 그리는 요소에만 직접 붙인다.
 * 대표 요소 몇 개로 그 클래스가 빠지지 않았는지 지킨다.
 */
describe("긴 안내 문구의 줄바꿈 (break-keep)", () => {
  it("오프라인 배너 문구", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status").className).toContain("break-keep");
    vi.restoreAllMocks();
  });

  it("서열표 첫 방문 안내", () => {
    render(<TableTip />);
    expect(screen.getByText(ko.Table.tilesTip).className).toContain("break-keep");
    // flex 안의 글줄은 min-w-0이 있어야 좁은 폭에서 `×` 버튼을 화면 밖으로 밀어내지 않는다(D101)
    expect(screen.getByText(ko.Table.tilesTip).className).toContain("min-w-0");
  });

  it("라이벌 설명서의 목록", () => {
    render(<RivalGuide />);
    const li = screen.getByText(ko.RivalGuide.reg1);
    expect(li.closest("ul")?.className).toContain("break-keep");
  });

  it("속성별 화면에서 폴더로 들어왔을 때의 안내 한 줄", () => {
    render(<PatternFromGridBar pattern="복합" active hasAnyFilter onClearPattern={() => {}} onReset={() => {}} />);
    const note = screen.getByText(/복합/, { selector: "p" });
    expect(note.className).toContain("break-keep");
  });

  it("추천 줄의 `비슷한 실력대 N명` 근거", () => {
    render(<PeerReason item={{ reason: "PEER_TIER", peerUsers: 12 }} />);
    expect(screen.getByText("12").parentElement?.className).toContain("break-keep");
  });
});
