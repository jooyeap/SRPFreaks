"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { fetchRivalStatus, registerRival, rivalKeys, unregisterRival } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 유저 상세의 `라이벌 등록` + `비교` (D56). 로그인했고 본인이 아닐 때만 그린다(부모가 정한다).
 * 등록 상태는 서버(rival-status)가 정하고, 등록·해제 뒤에는 라이벌 관련 캐시("rivals")를 모두 버린다.
 * 해제는 되돌리기 번거로우므로 확인 창을 거친다. 등록·서로 등록 상태는 글자(✓, `서로 등록`)로도 보인다(색만 쓰지 않는다).
 */
export function RivalButtons({ viewerId, targetId, nickname }: { viewerId: number; targetId: number; nickname: string }) {
  const t = useTranslations("Rival");
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const { data } = useQuery({
    queryKey: rivalKeys.status(viewerId, targetId),
    queryFn: ({ signal }) => fetchRivalStatus(targetId, signal),
    retry: false,
  });
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: rivalKeys.all });
  };
  const register = useMutation({
    mutationFn: () => registerRival(targetId),
    onSuccess: async () => {
      toast(t("registered", { nickname }));
      await done();
    },
  });
  const unregister = useMutation({
    mutationFn: () => unregisterRival(targetId),
    onSuccess: async () => {
      setConfirming(false);
      toast(t("unregistered", { nickname }));
      await done();
    },
  });

  const full = data !== undefined && !data.registered && data.count >= data.max;
  const error = register.error ?? unregister.error;
  const message = error instanceof ApiError ? error.message : error ? t("failed") : null;
  const base = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm disabled:text-disabled";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {data?.registered ? (
          <button
            type="button"
            aria-pressed="true"
            onClick={() => setConfirming(true)}
            className={`${base} flex-1 border-chip-on-bg bg-chip-on-bg font-semibold text-chip-on-fg`}
          >
            <span aria-hidden="true">✓</span>
            {data.mutual ? t("mutualOn") : t("on")}
          </button>
        ) : (
          <button
            type="button"
            aria-pressed="false"
            disabled={data === undefined || full || register.isPending}
            onClick={() => register.mutate()}
            className={`${base} flex-1 border-ctl text-fg enabled:hover:bg-table-head`}
          >
            <span aria-hidden="true">+</span>
            {t("register")}
          </button>
        )}
        <Link href={`/players/${targetId}/compare`} className={`${base} border-ctl text-fg hover:bg-table-head`}>
          {t("compare")}
        </Link>
      </div>
      {data ? (
        <p className="text-xs text-fg-dim">
          {full ? t("full", { max: data.max }) : t("countLine", { count: data.count, max: data.max })}
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-xs text-danger">
          {message}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title={t("unregisterTitle")}
        message={t("unregisterMessage", { nickname })}
        confirmLabel={t("unregister")}
        pending={unregister.isPending}
        onConfirm={() => unregister.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
