"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { JacketImportPanel } from "@/components/admin/JacketImportPanel";
import { SongImportAdminView } from "@/components/admin/SongImportAdminView";

/** 공식 곡 목록 아티스트·레벨 갱신(D42)과 재킷 가져오기(D54) 화면 (ROOT 전용). */
export default function SongImportPage() {
  const t = useTranslations();
  return (
    <AdminGate title={t("SongImport.title")}>{() => (
        <div className="flex flex-col gap-8">
          <SongImportAdminView />
          <JacketImportPanel />
        </div>
      )}</AdminGate>
  );
}
