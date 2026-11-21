import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteFooter } from "@/components/SiteFooter";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("개인정보 처리방침", () => {
  it("수집 항목, 보관·삭제, 쿠키 안내가 들어 있다", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /수집하는 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /보관 기간과 삭제/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /쿠키/ })).toBeInTheDocument();
    expect(screen.getByText(/비밀번호는 받지도 저장하지도 않습니다/)).toBeInTheDocument();
  });

  it("공개한 기록이 같은 티어 유저 통계(익명, 5명 이상)에 쓰인다고 알린다", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/같은 티어 유저 통계\(인원 수·중앙값\)에도 쓰입니다/)).toBeInTheDocument();
    expect(screen.getByText(/5명 이상이 모였을 때만 보이며, 누구의 기록인지는 드러나지 않습니다/)).toBeInTheDocument();
  });

  it("공개한 기록이 운영자의 서열표 조정 근거로 쓰이고, 공개하지 않은 기록은 쓰이지 않는다고 알린다 (D77)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /이용 목적/ })).toBeInTheDocument();
    expect(screen.getByText(/운영자가 서열표\(곡별 난이도 정보\)를 조정하는 근거를 살피는 데에도 쓰입니다/)).toBeInTheDocument();
    expect(screen.getByText(/곡별 평균·중앙값·플레이어 수·기록 건수로 집계해 보며, 공개를 켜지 않은 회원님의 기록은 쓰이지 않습니다/)).toBeInTheDocument();
  });

  it("운영자에게 보이는 곡별 값(저장 횟수·마지막 플레이는 다른 이용자에게 안 보임)을 알린다 (D77)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/해당 곡 달성률, 그 곡의 저장 횟수, 마지막 플레이 시각이 보입니다/)).toBeInTheDocument();
    expect(screen.getByText(/저장 횟수와 마지막 플레이 시각은 다른 이용자에게는 보이지 않습니다/)).toBeInTheDocument();
  });

  it("이메일은 운영자 화면에만 보이고 곡별 집계 화면에는 이메일·역할·Google 식별자가 없다고 알린다", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/회원 관리를 위해 운영자 화면에는 이메일 주소가 보이며/)).toBeInTheDocument();
    expect(screen.getByText(/곡별 집계 화면에는 이메일 주소·역할·Google 식별자를 표시하지 않습니다/)).toBeInTheDocument();
  });

  it("로그인한 이용자에게 곡별 최고 달성률이 라이벌 비교·곡별 순위에 보인다고 알린다 (D56·D74)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/공개를 켠 회원님의 곡별 최고 달성률이 라이벌 비교와 곡별 순위 화면에 보입니다/)).toBeInTheDocument();
    expect(screen.getByText(/곡별 순위에서는 닉네임과 달성 단계, 티어가 함께 보입니다/)).toBeInTheDocument();
    expect(screen.getByText(/두 화면 모두 로그인해야 볼 수 있으며/)).toBeInTheDocument();
  });

  it("집계 화면을 조회하는 것만으로는 관리 기록이 남지 않는다고 알린다", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/데이터를 바꾸는 관리 작업은 기록으로 남깁니다/)).toBeInTheDocument();
    expect(screen.getByText(/집계 화면을 조회하는 것만으로는 기록이 남지 않습니다/)).toBeInTheDocument();
  });

  it("공개한 기록이 비슷한 실력대 추천의 곡별 인원 수로만 쓰인다고 알린다 (D89)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/같은 티어대 이용자에게 추천하는 곡을 고르는 데에도 쓰입니다/)).toBeInTheDocument();
    expect(screen.getByText(/곡별 인원 수로만 집계해 보여 주며, 이용자 본인의 기록은 제외합니다/)).toBeInTheDocument();
    expect(screen.getByText(/5명 미만이면 그 곡의 인원 수는 보이지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/누구의 기록인지는 드러나지 않으며, 공개를 켜지 않은 회원님의 기록은 포함되지 않습니다/)).toBeInTheDocument();
  });

  it("추천 근거 항목은 서열표 조정 근거 바로 뒤, 접속 기록 다음 이용 목적 마지막에 놓인다", () => {
    render(<PrivacyPage />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    const a = items.findIndex((t) => t.includes("서열표(곡별 난이도 정보)를 조정하는 근거"));
    const b = items.findIndex((t) => t.includes("추천하는 곡을 고르는 데에도"));
    expect(b).toBe(a + 1);
  });

  it("시행일이 2026년 11월 21일로 바뀌었다 (배포일에 맞춰 최종 조정)", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/시행일: 2026년 11월 21일/)).toBeInTheDocument();
  });

  it("문의 메일이 설정돼 있으면 문의처에 보여 준다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "contact@example.com");
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: "contact@example.com" })).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("푸터에서 처리방침으로 갈 수 있다", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
  });

  it("로그인 화면에 처리방침 링크와 동의 안내가 있다", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByText(/동의한 것으로 봅니다/)).toBeInTheDocument();
  });

  it("로그인 버튼과 동의 안내는 한 카드 안에 들어 있다", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );
    const card = screen.getByTestId("login-card");
    expect(card).toHaveClass("rounded-2xl", "border-line", "bg-card");
    expect(card).toContainElement(screen.getByRole("link", { name: "개인정보 처리방침" }));
  });
});
