"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { difficultyLabel, partLabel } from "@/lib/format";
import {
  DIFFICULTY_CHOICES,
  emptyChart,
  emptySongCreate,
  MAX_CHARTS,
  newProgress,
  PART_CHOICES,
  registerSong,
  SONG_CREATE_AFFECTED_KEYS,
  songCreateSchema,
  type SongCreateValues,
} from "@/lib/song-admin";
import { PATTERN_CHOICES, RECOMMEND_CHOICES } from "@/lib/table-entry-admin";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 곡 등록 창(ROOT·ADMIN). TableEntryEditDialog와 같이 브라우저 기본 <dialog>를 쓴다
 * (포커스 가두기, Esc 닫기를 브라우저가 처리하고, 바깥 클릭으로는 닫히지 않는다). 모바일은 아래 시트, md 이상은 가운데 창이다.
 * tableId가 있으면 서열표 화면에서 연 것이라 채보마다 서열표 값(기준 난이도·추천도·속성)을 같이 받고 서열표에도 추가한다.
 * 닫으면 안의 폼을 지워서(언마운트) 다시 열 때 빈 폼으로 시작한다.
 */
export function SongCreateDialog({ open, tableId, onClose }: { open: boolean; tableId: number | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-xl md:rounded-xl"
    >
      {open ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="mb-3 text-lg font-extrabold">
            곡 등록
          </h2>
          <SongCreateForm tableId={tableId} onDone={onClose} />
        </>
      ) : null}
    </dialog>
  );
}

function SongCreateForm({ tableId, onDone }: { tableId: number | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  // 등록 진행 상태(곡/채보 id). 렌더가 바뀌어도 유지돼야 해서 ref에 둔다. 실패 후 다시 시도할 때 이미 만든 것을 건너뛴다.
  const progress = useRef(newProgress());
  const [locked, setLocked] = useState(false); // 곡은 만들어졌는데 채보 저장이 실패한 상태: 값을 바꾸지 못하게 잠근다
  const [createdSongId, setCreatedSongId] = useState<number | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SongCreateValues>({ resolver: zodResolver(songCreateSchema), defaultValues: emptySongCreate(), mode: "onTouched" });
  const { fields, append, remove } = useFieldArray({ control, name: "charts" });

  const mutation = useMutation({
    mutationFn: (values: SongCreateValues) => registerSong(values, tableId, progress.current),
    onSuccess: async (songId) => {
      await Promise.all(SONG_CREATE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      setCreatedSongId(songId);
    },
    onError: async () => {
      if (progress.current.songId !== null) {
        // 곡은 이미 생겼으니 목록은 새로 받는다
        setLocked(true);
        await Promise.all(SONG_CREATE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      }
    },
  });

  if (createdSongId !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-fg">
          곡을 등록했습니다.
        </p>
        <div className="flex gap-2.5">
          <Link
            href={`/songs/${createdSongId}?from=songs`}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-chip-line text-sm font-bold text-fg hover:bg-table-head"
          >
            곡 상세 보기
          </Link>
          <button type="button" onClick={onDone} className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg">
            닫기
          </button>
        </div>
      </div>
    );
  }

  const failure = mutation.error;
  const fieldLines = failure instanceof ApiError && failure.fieldErrors ? Object.values(failure.fieldErrors) : [];
  const serverMessage =
    failure instanceof ApiError ? failure.message : failure ? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." : null;
  const chartsError = errors.charts?.root?.message ?? errors.charts?.message;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="song-title" className="text-sm text-fg-sub">
            곡명
          </label>
          <input
            id="song-title"
            type="text"
            autoComplete="off"
            aria-invalid={errors.title ? true : undefined}
            className={FIELD}
            {...register("title")}
          />
          {errors.title ? (
            <p role="alert" className="text-sm text-fg">
              {errors.title.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="song-artist" className="text-sm text-fg-sub">
              아티스트
            </label>
            <input id="song-artist" type="text" autoComplete="off" className={FIELD} {...register("artist")} />
            {errors.artist ? (
              <p role="alert" className="text-sm text-fg">
                {errors.artist.message}
              </p>
            ) : null}
          </div>
          <div className="flex w-40 flex-col gap-1">
            <label htmlFor="song-version" className="text-sm text-fg-sub">
              버전
            </label>
            <input id="song-version" type="text" autoComplete="off" className={FIELD} {...register("addedVersion")} />
            {errors.addedVersion ? (
              <p role="alert" className="text-sm text-fg">
                {errors.addedVersion.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-sub">채보</p>
          {fields.map((field, index) => {
            const chartErrors = errors.charts?.[index];
            const n = index + 1;
            return (
              <div key={field.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                {/* items-stretch: 선택 상자·입력칸·삭제 버튼의 높이를 한 줄에서 같게 맞춘다(버튼은 글자가 작아 혼자 낮아 보였다) */}
                <div className="flex flex-wrap items-stretch gap-2">
                  <select aria-label={`채보 ${n} 파트`} className={FIELD} {...register(`charts.${index}.part`)}>
                    {PART_CHOICES.map((part) => (
                      <option key={part} value={part}>
                        {partLabel(part)}
                      </option>
                    ))}
                  </select>
                  <select aria-label={`채보 ${n} 난이도`} className={FIELD} {...register(`charts.${index}.difficulty`)}>
                    {DIFFICULTY_CHOICES.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficultyLabel(difficulty)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="레벨 9.50"
                    aria-label={`채보 ${n} 레벨`}
                    aria-invalid={chartErrors?.level ? true : undefined}
                    // font-num을 쓰지 않는다: 옆 선택 상자(본문 글꼴)와 글꼴이 다르면 글자 위치가 어긋나고, 한글 placeholder는 숫자 글꼴에 글자가 없어 대체 글꼴로 그려진다
                    className={`${FIELD} w-28`}
                    {...register(`charts.${index}.level`)}
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`채보 ${n} 삭제`}
                    className="ml-auto inline-flex items-center rounded-full border border-chip-line px-4 text-sm text-fg-sub enabled:hover:text-fg disabled:opacity-40"
                  >
                    삭제
                  </button>
                </div>
                {chartErrors?.difficulty ? (
                  <p role="alert" className="text-sm text-fg">
                    {chartErrors.difficulty.message}
                  </p>
                ) : null}
                {chartErrors?.level ? (
                  <p role="alert" className="text-sm text-fg">
                    {chartErrors.level.message}
                  </p>
                ) : null}

                {tableId !== null ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="레이팅 상수 난이도 (비우면 미정)"
                      aria-label={`채보 ${n} 레이팅 상수 난이도`}
                      aria-invalid={chartErrors?.tier ? true : undefined}
                      className={`${FIELD} w-52`}
                      {...register(`charts.${index}.tier`)}
                    />
                    <select aria-label={`채보 ${n} 추천도`} className={FIELD} {...register(`charts.${index}.recommend`)}>
                      <option value="">추천도 없음</option>
                      {RECOMMEND_CHOICES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select aria-label={`채보 ${n} 속성`} className={FIELD} {...register(`charts.${index}.pattern`)}>
                      <option value="">속성 없음</option>
                      {PATTERN_CHOICES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {chartErrors?.tier ? (
                  <p role="alert" className="text-sm text-fg">
                    {chartErrors.tier.message}
                  </p>
                ) : null}
              </div>
            );
          })}
          {chartsError ? (
            <p role="alert" className="text-sm text-fg">
              {chartsError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => append(emptyChart())}
            disabled={fields.length >= MAX_CHARTS}
            className="self-start rounded-full border border-chip-line px-3 py-1.5 text-sm text-fg-sub enabled:hover:text-fg disabled:opacity-40"
          >
            채보 추가
          </button>
        </div>
      </fieldset>

      <p className="text-xs text-fg-dim">
        {tableId !== null
          ? "서열표에도 함께 추가됩니다. 레이팅 상수 난이도를 비우면 미정으로 들어가고 레이팅에서는 빠집니다. "
          : "곡 목록에만 등록되고 서열표에는 서열표 화면에서 추가합니다. "}
        등록하면 모든 사용자에게 보이고, 변경 내용은 관리 기록에 남습니다.
      </p>

      {locked ? (
        <p role="alert" className="text-sm text-fg">
          곡은 등록됐지만 일부 채보를 저장하지 못했습니다. 아래 버튼으로 남은 채보를 다시 저장해 주세요.
        </p>
      ) : null}
      {serverMessage ? (
        <div role="alert" className="text-sm text-fg">
          <p>{serverMessage}</p>
          {fieldLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onDone}
          className="h-12 w-24 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
        >
          {locked ? "닫기" : "취소"}
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
        >
          {mutation.isPending ? "등록 중" : locked ? "남은 채보 다시 저장" : "등록"}
        </button>
      </div>
    </form>
  );
}
