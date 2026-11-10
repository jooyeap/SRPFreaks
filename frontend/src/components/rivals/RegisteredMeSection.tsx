"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { RivalRegistrantResponse } from "@/lib/api-types";
import { fetchRegisteredMe, registerRival, rivalKeys } from "@/lib/rivals";
import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * 라이벌 탭의 `나를 등록한 유저` 구역(D63). 나를 라이벌로 등록한 "공개 유저"만 오고, 비공개 유저는 목록에도 인원수에도 없다
 * (서버가 걸러서 보내므로 화면은 숨겨진 사람을 짐작하게 하는 문구를 쓰지 않는다).
 * 줄마다 바로 라이벌 등록을 할 수 있다. 내 상한(5명)은 서버가 정하고, 찼으면 서버의 오류 문구를 그대로 보인다.
 * 서로 라이벌은 칩 글자로, 이미 등록한 줄의 버튼은 `등록됨` 글자로 막는다(색만으로 구분하지 않는다).
 */
export function RegisteredMeSection({ userId }: { userId: number }) {
  const t = useTranslations("Rival");
  const tc = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error } = useQuery({
    queryKey: rivalKeys.registeredMe(userId, page),
    queryFn: ({ signal }) => fetchRegisteredMe(page, signal),
    placeholderData: keepPreviousData,
  });
  const register = useMutation({
    mutationFn: (target: RivalRegistrantResponse) => registerRival(target.userId),
    onSuccess: async (_result, target) => {
      toast(t("registered", { nickname: target.nickname }));
      // 내 라이벌 목록·이 구역(서로 라이벌 표시)이 함께 새로 읽힌다
      await queryClient.invalidateQueries({ queryKey: rivalKeys.all });
    },
  });

  const message = register.error instanceof ApiError ? register.error.message : register.error ? t("failed") : null;

  return (
    <section aria-labelledby="registered-me-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="registered-me-title" className="text-[15px] font-bold text-fg">{t("registeredMeTitle")}</h2>
        {data ? <span className="font-num text-xs text-fg-dim">{t("registeredMeCount", { count: data.totalElements })}</span> : null}
      </div>
      {isPending ? <p className="text-sm text-fg-sub">{tc("Common.loading")}</p> : null}
      {isError ? (
        <p role="alert" className="text-sm text-fg">{error instanceof ApiError ? error.message : t("loadFailed")}</p>
      ) : null}
      {data && data.content.length === 0 ? <p className="text-sm text-fg-sub">{t("registeredMeEmpty")}</p> : null}
      {data && data.content.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.content.map((row) => (
            <li key={row.userId} className="flex items-center gap-2 rounded-2xl border border-line bg-card p-3">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                <Link href={`/players/${row.userId}`} className="min-w-0 max-w-full truncate text-[15px] font-bold text-fg underline-offset-2 hover:underline">
                  {row.nickname}
                </Link>
                <span data-tier={row.tier.key} className="tier-chip shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                  {row.tier.displayName}
                </span>
                {row.mutual ? (
                  <span className="shrink-0 rounded-full border border-ctl px-1.5 text-[11px] font-semibold text-fg-sub">{t("mutualChip")}</span>
                ) : null}
              </span>
              {row.mutual ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-ctl px-3 text-sm text-disabled"
                >
                  <span aria-hidden="true">✓</span>
                  {t("alreadyRegistered")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={register.isPending}
                  onClick={() => register.mutate(row)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-ctl px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
                >
                  <span aria-hidden="true">+</span>
                  {t("register")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <p role="alert" className="text-xs text-danger">{message}</p>
      ) : null}
      {data ? <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} /> : null}
    </section>
  );
}
