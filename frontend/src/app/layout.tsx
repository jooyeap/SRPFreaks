import type { Metadata } from "next";
import { Chakra_Petch, Noto_Sans_KR } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { themeInitScript } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

// 본문: Noto Sans KR (가변 글꼴이라 weight 지정이 필요 없다). 한글 글꼴은 조각이 많아 미리 불러오지 않는다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  preload: false,
});

// 숫자·영문 라벨: Chakra Petch (가변 글꼴이 아니라서 쓰는 굵기를 적는다)
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SRPFreaks",
  description: "GITADORA 플레이 기록을 SRN+ 옵션으로 저장하고 레이팅 목록을 계산하는 비공식 팬 프로젝트",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 React보다 먼저 <html data-theme>을 바꾸기 때문에
    // 서버가 그린 속성과 달라 보이는 것이 정상이다. 이 요소의 속성 차이만 경고에서 제외한다.
    <html lang="ko" suppressHydrationWarning className={`${notoSansKr.variable} ${chakraPetch.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-page font-sans text-fg">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-[980px] flex-1 px-4 py-6">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
