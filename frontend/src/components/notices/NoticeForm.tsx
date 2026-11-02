"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { NOTICE_CONTENT_MAX, NOTICE_TITLE_MAX, makeNoticeSchema, type NoticeValues } from "@/lib/notices";
import { useTranslations } from "next-intl";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 공지 쓰기·고치기 폼 (ADMIN·ROOT). 제목과 내용(글자만)을 받는다. 서버가 거절한 문구는 error로 넘겨 받아 보여 준다.
 * onSubmit이 성공하면 부모가 폼을 닫거나(고치기) 비운다(쓰기: resetOnSuccess).
 */
export function NoticeForm({
  label,
  initial,
  submitLabel,
  pending,
  error,
  resetOnSuccess = false,
  onSubmit,
  onCancel,
}: {
  /** 폼의 이름(접근성용). 예: `공지 쓰기` */
  label: string;
  initial?: NoticeValues;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  resetOnSuccess?: boolean;
  onSubmit: (values: NoticeValues) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoticeValues>({
    resolver: zodResolver(makeNoticeSchema(t)),
    defaultValues: initial ?? { title: "", content: "" },
  });

  return (
    <form
      aria-label={label}
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          if (resetOnSuccess) {
            reset({ title: "", content: "" });
          }
        } catch {
          // 실패 문구는 부모가 error로 넘겨 준다. 입력한 내용은 지우지 않는다.
        }
      })}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4"
    >
      <label className="flex flex-col gap-1 text-sm text-fg-sub">
        {t("Common.fieldTitle")}
        <input type="text" maxLength={NOTICE_TITLE_MAX + 50} className={FIELD} {...register("title")} />
      </label>
      {errors.title ? (
        <p role="alert" className="text-sm text-fg">
          {errors.title.message}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-fg-sub">
        {t("Common.fieldContent")}
        <textarea rows={6} maxLength={NOTICE_CONTENT_MAX + 500} className={FIELD} {...register("content")} />
      </label>
      {errors.content ? (
        <p role="alert" className="text-sm text-fg">
          {errors.content.message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-fg">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
        >
          {pending ? t("Common.saving") : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg-sub hover:text-fg"
          >
            {t("Common.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
