"use client";

import { useTranslations } from "next-intl";
import { AdminGate } from "@/components/admin/AdminGate";
import { SongMetaView } from "@/components/admin/SongMetaView";

/** 곡 정보 정리(D91): 아티스트·검색 키워드가 비어 있는 곡을 모아 채우는 화면 (ADMIN 이상). */
export default function SongMetaPage() {
  const t = useTranslations();
  return <AdminGate title={t("SongMeta.title")} minRole="ADMIN">{(viewerId) => <SongMetaView viewerId={viewerId} />}</AdminGate>;
}
