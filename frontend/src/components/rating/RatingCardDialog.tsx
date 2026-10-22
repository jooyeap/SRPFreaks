"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useOptionalUser } from "@/components/AuthProvider";
import type { SkillResponse } from "@/lib/api-types";
import { buildCardModel, CARD_LAYOUTS, cardFileName, type CardLayout } from "@/lib/rating-card";
import { renderRatingCard } from "@/lib/rating-card-draw";

/**
 * 레이팅 카드 이미지 저장 (D44). 버튼을 누르면 창이 열리고, 브라우저 캔버스로 PNG를 만들어 미리 보여 준다. 서버로 아무것도 보내지 않는다.
 *
 * 미리보기는 `toDataURL`(data: 주소)로 보인다 — CSP가 `img-src 'self' data:`라 blob: 주소는 막히기 때문이다.
 * 저장은 `toBlob` + 임시 <a download> 클릭이다. iOS Safari처럼 download가 안 먹는 브라우저를 위해 "이미지를 길게 눌러 저장" 안내를 둔다.
 */
export function RatingCardButton({ skill }: { skill: SkillResponse }) {
  const t = useTranslations("RatingCard");
  const [open, setOpen] = useState(false);
  if (skill.single.length + skill.other.length === 0) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 self-start rounded-xl border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg"
      >
        {t("open")}
      </button>
      {open ? <RatingCardDialog skill={skill} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

type Status = "preparing" | "ready" | "failed";

function RatingCardDialog({ skill, onClose }: { skill: SkillResponse; onClose: () => void }) {
  const t = useTranslations();
  const user = useOptionalUser();
  const ref = useRef<HTMLDialogElement>(null);
  const [layout, setLayout] = useState<CardLayout>("landscape");
  const [showName, setShowName] = useState(true);
  // 그린 결과는 "어떤 옵션으로 그렸는지(key)"와 함께 보관한다. 옵션이 바뀌면 key가 달라져 자동으로 "만드는 중"이 된다
  // (effect 안에서 setState로 상태를 되돌리지 않아도 된다).
  const [result, setResult] = useState<{ key: string; dataUrl: string | null } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 날짜는 창을 연 시점으로 고정한다(옵션을 바꿀 때마다 시각이 바뀌지 않게)
  const [now] = useState(() => new Date());

  const nickname = showName ? (user?.nickname ?? null) : null;
  const key = `${layout}|${nickname ?? ""}`;
  const status: Status = result?.key !== key ? "preparing" : result.dataUrl ? "ready" : "failed";
  const dataUrl = status === "ready" ? result?.dataUrl : null;
  // t는 렌더마다 새로 만들어질 수 있어 창을 연 때의 것을 고정한다(창이 열린 동안 언어는 바뀌지 않는다).
  // 그림은 key(배치·닉네임)가 바뀔 때만 다시 만든다.
  const [translate] = useState(() => t);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // 일부 환경(테스트용 가짜 브라우저)에는 showModal이 없어서 open 속성으로 대신한다
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const model = buildCardModel(layout, skill, translate, { nickname, now });
    renderRatingCard(model)
      .then((canvas) => {
        if (cancelled) return;
        canvasRef.current = canvas;
        setResult({ key, dataUrl: canvas.toDataURL("image/png") });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, layout, nickname, skill, now, translate]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setResult({ key, dataUrl: null });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cardFileName(now);
      a.click();
      // 클릭 직후 바로 해제하면 일부 브라우저가 저장을 못 하므로 조금 뒤에 해제한다
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, "image/png");
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="rating-card-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(56rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-line bg-card p-4 text-fg backdrop:bg-black/60 sm:p-5"
    >
      <h2 id="rating-card-title" className="text-lg font-extrabold">
        {t("RatingCard.dialogTitle")}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="radiogroup" aria-label={t("RatingCard.layoutLabel")} className="flex gap-2">
          {CARD_LAYOUTS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={layout === value}
              onClick={() => setLayout(value)}
              className={`h-10 rounded-xl border px-4 text-sm font-bold ${
                layout === value ? "border-fg text-fg" : "border-chip-line text-fg-sub hover:text-fg"
              }`}
            >
              {value === "landscape" ? t("RatingCard.layoutLandscape") : t("RatingCard.layoutPortrait")}
            </button>
          ))}
        </div>
        {user?.nickname ? (
          <label className="flex items-center gap-2 text-sm text-fg-sub">
            <input type="checkbox" checked={showName} onChange={(event) => setShowName(event.target.checked)} />
            {t("RatingCard.showNickname")}
          </label>
        ) : null}
      </div>

      <div className="mt-3 flex min-h-40 items-center justify-center rounded-xl bg-bg p-2">
        {status === "failed" ? (
          <p role="alert" className="text-sm text-danger">
            {t("RatingCard.failed")}
          </p>
        ) : dataUrl && status === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: 주소의 미리보기라 next/image가 필요 없다
          <img src={dataUrl} alt={t("RatingCard.previewAlt")} className="max-h-[60dvh] w-auto max-w-full object-contain" />
        ) : (
          <p role="status" className="text-sm text-fg-sub">
            {t("RatingCard.preparing")}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-fg-sub">{t("RatingCard.hint")}</p>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="h-11 flex-1 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
        >
          {t("RatingCard.close")}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={status !== "ready"}
          className="h-11 flex-1 rounded-xl border border-fg text-sm font-bold disabled:opacity-60"
        >
          {t("RatingCard.download")}
        </button>
      </div>
    </dialog>
  );
}
