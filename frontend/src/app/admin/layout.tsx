import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/page-metadata";

/** 탭 제목만 정한다(관리 화면 전체(하위 화면 포함)). 화면 본문은 page.tsx가 그린다. */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("Nav.admin");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
