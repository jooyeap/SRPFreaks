import { apiFetch } from "@/lib/api";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 사진 입력(D55). 서버가 권한·한도를 정하고(RecognizeAccessPolicy), 화면은 상태만 보고 그린다.
 * 사진은 브라우저에서 긴 변 1,024px JPEG로 다시 그려 보낸다(위치 정보 등 EXIF가 남지 않고, 서버 한도 1MB 안에 들어간다).
 */

export type RecognizeUnavailableReason = "DISABLED" | "ROLE" | "WEEKLY_LIMIT" | "DAILY_LIMIT";

export interface RecognizeStatus {
  available: boolean;
  reason: RecognizeUnavailableReason | null;
  remaining: number;
  weeklyLimit: number;
  nextRefillAt: string | null;
}

export interface RecognizeResult {
  title: string | null;
  part: InstrumentPart | null;
  difficulty: DifficultyType | null;
  level: number | null;
  achievementRate: number | null;
  fullCombo: boolean | null;
  superRandomPlus: boolean | null;
  songDifficultyId: number | null;
  candidates: { songId: number; title: string }[];
  remaining: number;
}

/** 한 번에 고를 수 있는 사진 수(D55). */
export const MAX_PHOTOS = 10;
/** 긴 변. 옵션 칸(S.RANDOM+)처럼 작은 글자를 읽으려고 1,024 → 1,568px로 올렸다(2026-10-29). 인식 모델이 줄이지 않고 받는 최대 크기다. */
const MAX_SIDE = 1568;
/** 서버·nginx 요청 한도(1MB)보다 조금 작게. 넘으면 품질을 낮춰 다시 만든다. */
const MAX_BYTES = 950 * 1024;
const JPEG_QUALITIES = [0.85, 0.7, 0.55];

export const recognizeKeys = {
  status: (userId: number) => ["recognize", "status", userId] as const,
};

export function fetchRecognizeStatus(signal?: AbortSignal): Promise<RecognizeStatus> {
  return apiFetch<RecognizeStatus>("/records/recognize/status", { signal });
}

export function recognizePhoto(image: Blob): Promise<RecognizeResult> {
  const form = new FormData();
  form.append("image", image, "photo.jpg");
  return apiFetch<RecognizeResult>("/records/recognize", { method: "POST", body: form });
}

/** 사진 입력 메뉴·링크를 보일지. 꺼져 있거나 권한이 없으면 숨기고, 한도만 다 쓴 경우는 보여 준다(언제 풀리는지 안내). */
export function showsPhotoEntry(status: RecognizeStatus | undefined): status is RecognizeStatus {
  return status !== undefined && (status.available || status.reason === "WEEKLY_LIMIT" || status.reason === "DAILY_LIMIT");
}

/** 원본 크기에서 긴 변을 1,568px 이하로 줄인 크기(작으면 그대로). */
export function fitSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** 사진을 줄여 JPEG로 다시 그린다. Canvas로 다시 그리므로 EXIF(위치 등)는 남지 않는다. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const quality of JPEG_QUALITIES) {
    blob = await toJpeg(canvas, quality);
    if (blob.size <= MAX_BYTES) {
      break;
    }
  }
  if (!blob) {
    throw new Error("toBlob");
  }
  return blob;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", quality);
  });
}
