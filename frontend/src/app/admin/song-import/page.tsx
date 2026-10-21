"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { SongImportAdminView } from "@/components/admin/SongImportAdminView";

/** 공식 곡 목록 아티스트·레벨 갱신 화면 (ROOT 전용, D42). */
export default function SongImportPage() {
  const t = useTranslations();
  return <AdminGate title={t("SongImport.title")}>{() => <SongImportAdminView />}</AdminGate>;
}
