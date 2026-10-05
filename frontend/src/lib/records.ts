import { apiFetch } from "@/lib/api";
import { formatPlayedDate, toHundredths } from "@/lib/format";
import type { RecordFormValues } from "@/lib/record-schema";
import type { DifficultyType, InstrumentPart, NoteOption, AchievementStage } from "@/lib/types";

/** 서버 RecordResponse와 같은 모양. */
export interface RecordResponse {
  id: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  noteOption: NoteOption;
  achievementRate: number;
  fullCombo: boolean;
  stage: AchievementStage;
  playedAt: string | null;
  platform: string | null;
  memo: string | null;
}

/** 서버 RecordRequest와 같은 모양. */
export interface RecordRequestBody {
  songDifficultyId: number;
  noteOption: NoteOption;
  achievementRate: number;
  fullCombo: boolean;
  playedAt: string;
  memo: string | null;
}

/** 오늘(Asia/Seoul) 날짜 `YYYY-MM-DD`. */
export function todaySeoul(): string {
  return formatPlayedDate(new Date().toISOString());
}

/** 달성률 100.00이면 풀콤보는 항상 true (서버도 같은 규칙, D24). 문자열이 숫자가 아니면 false. */
export function isMaxRate(rate: string): boolean {
  const value = Number(rate.trim());
  return rate.trim() !== "" && toHundredths(value) === 10000;
}

/**
 * 서울 기준 날짜(`2026-10-05`)를 UTC 시각 문자열로 바꾼다. 그날 서울 0시를 뜻한다.
 * 서버는 시간을 UTC(Instant)로 저장하고 화면에서만 서울로 바꾸므로(CLAUDE.md), 보내는 쪽에서 오프셋(+09:00)을 붙여 변환한다.
 * 오늘 날짜를 골라도 서울 0시는 이미 지난 시각이라 서버의 "미래 시각 거부" 검사에 걸리지 않는다.
 */
export function seoulDateToInstant(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/** 폼 값 -> 서버 요청. 노트 옵션은 SRN+ 하나만 받으므로(D25) 항상 SRN+를 보낸다. */
export function toRecordRequest(songDifficultyId: number, values: RecordFormValues): RecordRequestBody {
  const memo = values.memo.trim();
  return {
    songDifficultyId,
    noteOption: "SUPER_RANDOM_PLUS",
    achievementRate: Number(values.achievementRate.trim()),
    fullCombo: values.fullCombo || isMaxRate(values.achievementRate),
    playedAt: seoulDateToInstant(values.playedDate),
    memo: memo === "" ? null : memo,
  };
}

export function createRecord(body: RecordRequestBody): Promise<RecordResponse> {
  return apiFetch<RecordResponse>("/records", { method: "POST", body });
}
