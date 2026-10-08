"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ChartBadge } from "@/components/table/Badges";
import { ApiError } from "@/lib/api";
import type { TableEntryResponse } from "@/lib/api-types";
import {
  PATTERN_CHOICES,
  RECOMMEND_CHOICES,
  saveTableEntry,
  TABLE_ENTRY_AFFECTED_KEYS,
  tableEntrySchema,
  tableEntryToFormValues,
  toTableEntryBody,
  type TableEntryFormValues,
} from "@/lib/table-entry-admin";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/** 수정할 서열표 줄. entry가 null이면 표에 아직 없는 채보라서 저장하면 새 줄로 추가된다. */
export interface TableEntryTarget {
  tableId: number;
  songDifficultyId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number | null;
  entry: TableEntryResponse | null;
}

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 서열표 값 수정 창(ROOT·ADMIN). RecordDialog와 같이 브라우저 기본 <dialog>를 쓴다
 * (바깥 클릭 차단, 포커스 가두기, Esc 닫기를 브라우저가 처리한다). 모바일은 아래에서 올라오는 시트, md 이상은 가운데 창이다.
 */
export function TableEntryEditDialog({ target, onClose }: { target: TableEntryTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (target && !dialog.open) {
      // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!target && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [target]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="table-entry-dialog-title"
      onClose={onClose}
      // 창 바깥(::backdrop)을 눌렀을 때만 닫는다. 창 안쪽 여백을 눌러도 target이 dialog 자신이라서 좌표로 구분한다
      // (입력 중에 여백을 잘못 눌러 내용이 사라지지 않게).
      onClick={(event) => {
        if (event.target !== ref.current) {
          return;
        }
        const rect = ref.current.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) {
          onClose();
        }
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {target ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id="table-entry-dialog-title" className="mb-3 text-lg font-extrabold">
            {target.entry ? "서열표 값 수정" : "서열표에 추가"}
          </h2>
          {/* key: 다른 채보로 열면 폼을 새로 만들어 초기값이 맞게 한다 */}
          <TableEntryForm key={target.songDifficultyId} target={target} onDone={onClose} />
        </>
      ) : null}
    </dialog>
  );
}

function TableEntryForm({ target, onDone }: { target: TableEntryTarget; onDone: () => void }) {
  const queryClient = useQueryClient();
  const defaultValues = useMemo(() => tableEntryToFormValues(target.tier, target.entry), [target]);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<TableEntryFormValues>({ resolver: zodResolver(tableEntrySchema), defaultValues, mode: "onTouched" });

  // 레이팅 반영 스위치는 입력칸이 아니라 켜짐/꺼짐 버튼이라 register 대신 useWatch/setValue로 다룬다
  // (watch 대신 useWatch: React Compiler 린트가 watch를 허용하지 않는다)
  const ratingEnabled = useWatch({ control, name: "ratingEnabled" });
  const tierValue = useWatch({ control, name: "tier" }).trim();
  const patternValue = useWatch({ control, name: "pattern" });
  // 스위치를 켜도 기준 난이도·속성이 없거나 속성이 '레이팅 제외'이면 계산에 들어가지 않는다 (서버 규칙과 같다)
  const switchIneffective = ratingEnabled && (tierValue === "" || patternValue === "" || patternValue === "레이팅 제외");

  const mutation = useMutation({
    mutationFn: (values: TableEntryFormValues) =>
      saveTableEntry(target.tableId, target.songDifficultyId, toTableEntryBody(values)),
    onSuccess: async () => {
      await Promise.all(TABLE_ENTRY_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onDone();
    },
    onError: (error) => {
      // 서버가 필드별 오류를 주면 해당 입력칸 아래에 보여 준다 (서버의 필드 이름은 tierLabel)
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (field === "tierLabel") {
            setError("tier", { message });
          } else if (field === "recommend" || field === "pattern") {
            setError(field, { message });
          }
        }
      }
    },
  });

  const failure = mutation.error;
  const serverMessage =
    failure instanceof ApiError && !failure.fieldErrors
      ? failure.message
      : failure && !(failure instanceof ApiError)
        ? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold text-fg">{target.title}</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-fg-sub">
          <ChartBadge part={target.part} difficulty={target.difficulty} level={target.level} />
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="entry-tier" className="text-sm text-fg-sub">
          기준 난이도
        </label>
        <input
          id="entry-tier"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="비우면 미정"
          aria-invalid={errors.tier ? true : undefined}
          aria-describedby="entry-tier-hint"
          className={`${FIELD} w-40 font-num`}
          {...register("tier")}
        />
        <p id="entry-tier-hint" className="text-[11px] text-fg-faint">
          0.0 이상, 소수 첫째 자리까지 · 비우면 미정(레이팅에서 제외)
        </p>
        {errors.tier ? (
          <p role="alert" className="text-sm text-fg">
            {errors.tier.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="entry-recommend" className="text-sm text-fg-sub">
            추천도
          </label>
          <select id="entry-recommend" className={FIELD} {...register("recommend")}>
            <option value="">없음</option>
            {RECOMMEND_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {errors.recommend ? (
            <p role="alert" className="text-sm text-fg">
              {errors.recommend.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="entry-pattern" className="text-sm text-fg-sub">
            속성
          </label>
          <select id="entry-pattern" className={FIELD} {...register("pattern")}>
            <option value="">없음</option>
            {PATTERN_CHOICES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {errors.pattern ? (
            <p role="alert" className="text-sm text-fg">
              {errors.pattern.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span id="entry-rating-label" className="text-sm text-fg-sub">
            레이팅 반영
          </span>
          <span className="flex items-center gap-2">
            {/* 색만으로 구분하지 않도록 켜짐/꺼짐 글자를 같이 보여 준다 */}
            <span className="font-num text-xs font-semibold text-fg">{ratingEnabled ? "켜짐" : "꺼짐"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={ratingEnabled}
              aria-labelledby="entry-rating-label"
              aria-describedby="entry-rating-hint"
              onClick={() => setValue("ratingEnabled", !ratingEnabled, { shouldDirty: true })}
              className={`relative h-6 w-11 shrink-0 rounded-full border border-chip-line transition-colors ${
                ratingEnabled ? "bg-chip-on-bg" : "bg-table-head"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
                  ratingEnabled ? "left-5.5 bg-chip-on-fg" : "left-0.5 bg-fg-dim"
                }`}
              />
            </button>
          </span>
        </div>
        <p id="entry-rating-hint" className="text-[11px] text-fg-faint">
          꺼 두면 기준 난이도와 속성이 있어도 모든 사용자의 레이팅에서 빠지고, 기록은 그대로 남습니다.
        </p>
        {switchIneffective ? (
          <p role="status" className="text-sm text-fg">
            지금 값으로는 계산에 들어가지 않습니다. 기준 난이도와 속성(레이팅 제외 아님)이 필요합니다.
          </p>
        ) : null}
      </div>

      <p className="text-xs text-fg-dim">
        기준 난이도와 속성이 모두 있어야 레이팅에 들어갑니다. 속성이 없거나 레이팅 제외이면 기록만 남습니다. 저장하면 모든 사용자의
        서열표와 레이팅에 반영되고, 변경 내용은 관리 기록에 남습니다.
      </p>

      {serverMessage ? (
        <p role="alert" className="text-sm text-fg">
          {serverMessage}
        </p>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="h-12 w-24 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
        >
          {mutation.isPending ? "저장 중" : target.entry ? "저장" : "추가"}
        </button>
      </div>
    </form>
  );
}
