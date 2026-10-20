import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ImportHandoff } from "@/components/import/ImportHandoff";
import { OfflineBanner } from "@/components/OfflineBanner";
import { NicknameNotice } from "@/components/NicknameNotice";
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

// 일본어 글꼴. 한글 글꼴(Noto Sans KR)에는 일본어 한자·가나가 없어서, 글자를 찾지 못하면 이 글꼴로 넘어간다(--font-sans의 순서).
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  preload: false,
});

// 숫자·영문 라벨: Chakra Petch (가변 글꼴이 아니라서 쓰는 굵기를 적는다)
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return {
    title: "SRPFreaks",
    description: t("description"),
    // iOS "홈 화면에 추가" 아이콘과 전체 화면 실행
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "SRPFreaks", statusBarStyle: "black-translucent" },
  };
}

// 휴대폰 주소창·상태 표시줄 색을 테마 바탕색에 맞춘다. viewportFit=cover: 노치·홈 바 영역까지 쓰고 safe-area 여백은 화면이 직접 둔다(탭바가 이미 처리한다)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
    { media: "(prefers-color-scheme: light)", color: "#f3f5f9" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale(); // 쿠키·브라우저 언어로 정한 이번 요청의 언어 (src/i18n/request.ts)
  return (
    // suppressHydrationWarning: 아래 스크립트가 React보다 먼저 <html data-theme>을 바꾸기 때문에
    // 서버가 그린 속성과 달라 보이는 것이 정상이다. 이 요소의 속성 차이만 경고에서 제외한다.
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${notoSansKr.variable} ${notoSansJp.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-page pb-[var(--tabbar-h)] font-sans text-fg">
        <NextIntlClientProvider>
        <Providers>
          <SiteHeader />
          <OfflineBanner />
          <NicknameNotice />
          <ImportHandoff />
          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">{children}</main>
          <SiteFooter />
          <MobileTabBar />
        </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
