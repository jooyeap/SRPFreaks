import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/page-metadata";

/** 탭 제목만 정한다(최근 플레이 가져오기). 화면 본문은 page.tsx가 그린다. */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("Nav.import");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
