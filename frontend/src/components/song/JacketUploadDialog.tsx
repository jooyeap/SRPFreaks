"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/Toast";
import { apiFetch, ApiError } from "@/lib/api";
import { resizeToJacket } from "@/lib/jacket-resize";
import { jacketKeys } from "@/lib/jackets";
import { saveJackets } from "@/lib/song-jackets";
import { songKeys } from "@/lib/songs";

/**
 * 곡 상세 `관리` → `재킷 바꾸기`(ROOT 전용, 2026-11-02). 공식 목록에 없는 곡의 재킷을 직접 넣거나 바꾸고 지운다.
 * 고른 이미지는 브라우저에서 200px 정사각 WebP로 줄여 미리 보여 주고, `저장`을 눌러야 서버로 보낸다(D54와 같은 저장 API).
 * resize는 테스트에서 바꿔 끼울 수 있게 받는다(jsdom에는 캔버스가 없다).
 */
export function JacketUploadDialog({
  open,
  onClose,
  songId,
  songTitle,
  hasJacket,
  resize = resizeToJacket,
}: {
  open: boolean;
  onClose: () => void;
  songId: number;
  songTitle: string;
  hasJacket: boolean;
  resize?: (file: Blob) => Promise<Blob>;
}) {
  const t = useTranslations();
  const toast = useToast();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
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

  // 미리보기 주소는 다 쓰면 풀어 준다(메모리)
  useEffect(() => () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: jacketKeys.all });
    await queryClient.invalidateQueries({ queryKey: songKeys.detail(songId) });
  };
  const close = () => {
    setBlob(null);
    setPreview(null);
    setError(null);
    onClose();
  };
  const save = useMutation({
    mutationFn: (image: Blob) => saveJackets([{ songId, blob: image }]),
    onSuccess: async () => {
      toast(t("JacketUpload.saved"));
      await refresh();
      close();
    },
  });
  const remove = useMutation({
    mutationFn: () => apiFetch<void>(`/admin/song-jackets/${songId}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast(t("JacketUpload.removed"));
      await refresh();
      close();
    },
  });
  const serverError = save.error ?? remove.error;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={close}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="text-lg font-extrabold">
            {t("JacketUpload.title")}
          </h2>
          <p className="truncate text-sm text-fg-sub">{songTitle}</p>
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-ctl px-3 text-sm font-semibold hover:bg-table-head">
            {t("JacketUpload.pick")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                setError(null);
                try {
                  const resized = await resize(file);
                  setBlob(resized);
                  setPreview(URL.createObjectURL(resized));
                } catch (e) {
                  setBlob(null);
                  setPreview(null);
                  setError(e instanceof Error && e.message === "too-large" ? t("JacketUpload.tooLarge") : t("JacketUpload.readFailed"));
                }
              }}
            />
          </label>
          <p className="text-xs text-fg-dim">{t("JacketUpload.hint")}</p>
          {preview ? (
            // 미리보기: 서열표·곡 목록에서 보이는 것과 같은 둥근 정사각
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t("JacketUpload.previewAlt", { title: songTitle })} className="mx-auto size-40 rounded-xl object-cover" />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          {serverError ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {serverError instanceof ApiError ? serverError.message : t("Common.saveFailed")}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!blob || save.isPending}
            onClick={() => blob && save.mutate(blob)}
            className="h-12 rounded-xl bg-[var(--chip-on-bg)] text-sm font-bold text-[var(--chip-on-fg)] disabled:opacity-50"
          >
            {t("JacketUpload.save")}
          </button>
          {hasJacket ? (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="h-11 rounded-xl border border-ctl text-sm text-fg-sub hover:text-fg disabled:opacity-50"
            >
              {t("JacketUpload.remove")}
            </button>
          ) : null}
          <button type="button" onClick={close} className="h-11 rounded-xl border border-ctl text-sm font-bold text-fg-sub hover:text-fg">
            {t("Common.close")}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
