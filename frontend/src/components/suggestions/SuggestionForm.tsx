"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  CATEGORY_LABELS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_CONTENT_MAX,
  SUGGESTION_TITLE_MAX,
  makeSuggestionSchema,
  type SuggestionValues,
} from "@/lib/suggestions";
import { useTranslations } from "next-intl";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 건의 보내기 폼. 종류·제목·내용(글자만)을 받는다. 서버가 거절한 문구(하루 제한 등)는 error로 넘겨 받아 보여 준다.
 * 보내기에 성공하면 입력을 비운다. 실패하면 입력한 내용을 그대로 둔다.
 */
export function SuggestionForm({
  initial,
  pending,
  error,
  onSubmit,
}: {
  initial: SuggestionValues;
  pending: boolean;
  error: string | null;
  onSubmit: (values: SuggestionValues) => Promise<unknown>;
}) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SuggestionValues>({ resolver: zodResolver(makeSuggestionSchema(t)), defaultValues: initial });

  return (
    <form
      aria-label={t("Suggestions.sendAria")}
      noValidate
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
          reset({ category: values.category, title: "", content: "" });
        } catch {
          // 실패 문구는 부모가 error로 넘겨 준다. 입력한 내용은 지우지 않는다.
        }
      })}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4"
    >
      <label className="flex flex-col gap-1 text-sm text-fg-sub">
        {t("Suggestions.fieldCategory")}
        <select className={FIELD} {...register("category")}>
          {SUGGESTION_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(CATEGORY_LABELS[category])}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-sub">
        {t("Common.fieldTitle")}
        <input type="text" maxLength={SUGGESTION_TITLE_MAX + 50} className={FIELD} {...register("title")} />
      </label>
      {errors.title ? (
        <p role="alert" className="text-sm text-fg">
          {errors.title.message}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-fg-sub">
        {t("Common.fieldContent")}
        <textarea rows={6} maxLength={SUGGESTION_CONTENT_MAX + 200} className={FIELD} {...register("content")} />
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
      <div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
        >
          {pending ? t("Suggestions.sending") : t("Suggestions.sendAria")}
        </button>
      </div>
    </form>
  );
}
