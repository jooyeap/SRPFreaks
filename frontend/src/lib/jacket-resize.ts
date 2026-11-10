import { JACKET_MAX_BYTES, JACKET_QUALITY, JACKET_SIZE } from "@/lib/jacket-reader";

/**
 * 직접 고른 이미지를 재킷 규격(200px 정사각 WebP, 50KB 이하)으로 줄인다(2026-11-02, 곡 상세 `재킷 바꾸기`).
 * 가운데를 정사각으로 잘라 200px로 그리고, 50KB를 넘으면 품질을 조금씩 낮춰 다시 만든다.
 * 서버(SongJacketAdminService)가 같은 규격을 다시 검사한다. 브라우저 안에서만 처리하고 원본은 보내지 않는다.
 */
export async function resizeToJacket(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = JACKET_SIZE;
  canvas.height = JACKET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, JACKET_SIZE, JACKET_SIZE);
  bitmap.close();
  for (const quality of jacketQualitySteps()) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.type === "image/webp" && blob.size <= JACKET_MAX_BYTES) {
      return blob;
    }
  }
  throw new Error("too-large");
}

/** 시도할 WebP 품질(높은 것부터). 가져오기와 같은 0.8에서 시작한다 */
export function jacketQualitySteps(): number[] {
  return [JACKET_QUALITY, 0.65, 0.5];
}
