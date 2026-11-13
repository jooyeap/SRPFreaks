"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { makeListNameSchema, type ListNameFormValues } from "@/lib/user-lists";

/**
 * 리스트 이름 입력 한 줄 폼(새 리스트 / 이름 변경 / 곡 상세 시트의 「새 리스트에 담기」가 같이 쓴다).
 * 화면은 비었는지·길이만 본다(Zod). 같은 이름·개수 한도 같은 규칙은 서버가 검사하고, 거절 문구는 부르는 쪽이 토스트로 보인다.
 * 보내는 것은 앞뒤 공백을 뗀 글자이고, NFKC 정규화는 서버가 한다.
 */
export function ListNameForm({
  initialName = "",
  submitLabel,
  pendingLabel,
  pending,
  autoFocus = true,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  autoFocus?: boolean;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const id = useId();
  const schema = useMemo(() => makeListNameSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ListNameFormValues>({ resolver: zodResolver(schema), defaultValues: { name: initialName } });
  const error = errors.name?.message;

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values.name))} noValidate className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-name`} className="text-xs text-fg-sub">
        {t("MyList.nameLabel")}
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="off"
          // 글자 수 제한은 코드포인트 기준이라 maxLength(UTF-16 단위)로 막지 않고 Zod로 알린다
          autoFocus={autoFocus}
          placeholder={t("MyList.namePlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-ctl bg-card px-3 text-sm text-fg placeholder:text-fg-dim"
          {...register("name")}
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 shrink-0 rounded-lg border border-ctl px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-10 shrink-0 rounded-lg px-2 text-sm text-fg-sub hover:text-fg">
            {t("Common.cancel")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
