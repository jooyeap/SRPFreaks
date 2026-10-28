import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/page-metadata";

/** 탭 제목만 정한다(사진으로 입력). 화면 본문은 page.tsx가 그린다. */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("Photo.title");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
