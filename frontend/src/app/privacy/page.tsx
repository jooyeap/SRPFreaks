import type { Metadata } from "next";
import { ContactLine } from "@/components/ContactLine";

export const metadata: Metadata = { title: "개인정보 처리방침 | SRPFreaks" };

/** 시행일. 내용을 바꾸면 이 날짜도 함께 바꾼다. */
const PRIVACY_EFFECTIVE_DATE = "2026년 10월 8일";

type Section = { title: string; body: string[] };

/**
 * 처리방침 본문. 실제 코드가 하는 일과 어긋나지 않게 쓴다 (예: 비밀번호를 받지 않음, 탈퇴 시 즉시 삭제, 14일 로그인 유지).
 * 서비스 동작이 바뀌면 이 문서도 같이 고친다.
 */
const SECTIONS: Section[] = [
  {
    title: "1. 수집하는 정보",
    body: [
      "Google 계정으로 로그인할 때 Google이 알려 주는 이메일 주소와 Google 계정 고유 식별자를 저장합니다. 비밀번호는 받지도 저장하지도 않습니다.",
      "회원님이 직접 입력한 닉네임(선택)과 플레이 기록(곡, 난이도, 파트, 달성률, 풀콤보 여부, 기록 시각)을 저장합니다.",
      "서비스를 안전하게 운영하기 위해 접속 IP 주소와 요청 경로가 서버 접속 기록에 남습니다.",
      "KONAMI 계정 정보는 수집하지 않으며, 공식 사이트와도 통신하지 않습니다.",
    ],
  },
  {
    title: "2. 이용 목적",
    body: [
      "이메일과 Google 식별자는 로그인과 계정 구분에만 씁니다.",
      "닉네임과 기록은 회원님의 레이팅과 티어를 계산하고 보여 주기 위해 씁니다.",
      "접속 기록은 오남용(반복 로그인 시도 등)을 막고 장애를 확인하는 데 씁니다.",
    ],
  },
  {
    title: "3. 다른 사람에게 보이는 정보",
    body: [
      "기본값은 비공개입니다. 회원님이 설정에서 직접 공개를 켠 경우에만 닉네임, 티어, 총점, 레이팅 목록이 유저 목록과 상세 화면에 보입니다. 언제든 다시 끌 수 있습니다.",
      "이메일 주소와 Google 식별자는 어떤 경우에도 다른 이용자에게 보이지 않습니다.",
    ],
  },
  {
    title: "4. 보관 기간과 삭제",
    body: [
      "회원님의 정보는 탈퇴할 때까지 보관합니다. 설정 화면에서 탈퇴하면 계정과 모든 기록이 바로 삭제되며 되돌릴 수 없습니다.",
      "운영자의 관리 작업 기록에 남아 있던 이 계정의 식별 정보도 함께 지워집니다.",
      "서버 접속 기록은 용량 제한으로 순환되며 오래된 기록부터 자동으로 지워집니다.",
    ],
  },
  {
    title: "5. 제3자 제공과 처리 위탁",
    body: [
      "회원님의 정보를 광고나 마케팅 목적으로 제공하지 않으며, 법령에 따른 요구가 있는 경우를 제외하고 제3자에게 넘기지 않습니다.",
      "로그인은 Google의 인증 서비스를 이용하고, 서비스는 Amazon Web Services의 서버에서 운영합니다.",
    ],
  },
  {
    title: "6. 쿠키",
    body: [
      "로그인을 유지하기 위한 쿠키 하나만 씁니다. 자바스크립트로 읽을 수 없는 보안 쿠키이며 14일 뒤 만료됩니다. 로그아웃하면 지워집니다.",
      "화면 테마(다크/라이트) 선택은 회원님의 브라우저에만 저장됩니다. 광고·분석용 쿠키는 쓰지 않습니다.",
    ],
  },
  {
    title: "7. 회원님의 권리",
    body: [
      "회원님은 언제든 내 정보를 확인하고, 닉네임과 공개 여부를 바꾸고, 기록을 수정·삭제하고, 탈퇴할 수 있습니다.",
      "그 밖의 열람·정정·삭제 요청은 아래 문의처로 보내 주세요.",
    ],
  },
  {
    title: "8. 안전하게 지키기 위한 조치",
    body: [
      "모든 통신은 HTTPS로 암호화합니다. 로그인 유지용 토큰은 해시만 저장합니다.",
      "관리자 권한은 최소한의 인원에게만 있고, 관리 작업은 기록으로 남깁니다.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-[720px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-fg">개인정보 처리방침</h1>
        <p className="text-sm text-fg-sub">
          SRPFreaks는 KONAMI와 무관한 비공식 팬 프로젝트이며, 서비스에 꼭 필요한 정보만 다룹니다. 시행일: {PRIVACY_EFFECTIVE_DATE}
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-base font-semibold text-fg">{section.title}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-sub">
            {section.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-fg">9. 문의처</h2>
        <ContactLine className="text-sm text-fg-sub" />
      </section>
    </article>
  );
}
