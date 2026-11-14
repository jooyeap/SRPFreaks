"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { SongCreateDialog } from "@/components/songs/SongCreateDialog";
import { StatusLabel } from "@/components/suggestions/StatusLabel";
import { ApiError } from "@/lib/api";
import type { AdminSuggestionResponse, SuggestionCategory, SuggestionStatus } from "@/lib/api-types";
import { fetchDifficultyTables, pickRatingTable } from "@/lib/difficulty-table";
import { formatPlayedDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  describeChartRequest,
  fetchAdminSuggestions,
  fetchReceivedCount,
  reviewSuggestion,
  STATUS_LABELS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_NOTE_MAX,
  SUGGESTION_STATUSES,
  suggestionKeys,
  SUGGESTIONS_PAGE_SIZE,
} from "@/lib/suggestions";
import { PageSizeSelect } from "@/components/PageSizeSelect";
import { usePageSize } from "@/lib/page-size";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-sm text-fg";

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Common.saveFailed");
}

/**
 * 건의 관리 (D35, ADMIN·ROOT). 종류·상태로 걸러 보고, 건마다 처리 상태와 답변을 남긴다.
 * 처리는 감사 로그에 기록된다(서버). 보낸 사람은 닉네임만 보인다. 권한은 서버가 다시 검사한다(403).
 *
 * 화면(D79): 상태 칩(접수 / 처리 완료 / 전체, 개수 표시)과 압축 카드 목록이다.
 *  - 폰: 카드를 누르면 그 자리에서 펼쳐 전체 내용·상태 선택·답변·저장이 나온다. 한 번에 하나만 펼친다.
 *  - 1024px 이상: 왼쪽 목록 + 오른쪽 상세 두 칸. 펼침 대신 선택이고, 고르기 전에는 첫 건이 선택돼 있다.
 * 같은 내용을 CSS로 두 번 그리지 않고 훅(useMediaQuery)으로 한쪽만 그린다(같은 입력칸이 DOM에 두 번 생기지 않게).
 * 기능·API·권한은 그대로다(목록·검토 API 그대로, 칩의 개수는 같은 목록 API를 한 건씩 요청해 totalElements로 센다).
 */
export function SuggestionsAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [category, setCategory] = useState<SuggestionCategory | "">("");
  // 상태 필터: 직접 고르기 전에는 접수 대기가 있으면 `접수`, 없으면 `전체`를 보여 준다(2026-10-27).
  // 대기 건수를 받은 뒤에 정해야 해서, 고르기 전에는 건수를 받을 때까지 목록 요청을 미룬다.
  const [chosenStatus, setChosenStatus] = useState<SuggestionStatus | "" | null>(null);
  const [page, setPage] = useState(0);
  // 펼친(폰) 또는 선택한(데스크톱) 건. 필터·쪽이 바뀌면 비운다.
  const [openId, setOpenId] = useState<number | null>(null);
  const [size, setSize] = usePageSize("adminSuggestions", SUGGESTIONS_PAGE_SIZE);
  useScrollTopOnChange(page);

  const count = useQuery({
    queryKey: suggestionKeys.receivedCount(viewerId),
    queryFn: ({ signal }) => fetchReceivedCount(signal),
  });
  const status: SuggestionStatus | "" = chosenStatus ?? ((count.data?.received ?? 0) > 0 ? "RECEIVED" : "");
  const list = useQuery({
    queryKey: suggestionKeys.admin(viewerId, category, status, page, size),
    queryFn: ({ signal }) => fetchAdminSuggestions({ category, status }, page, size, signal),
    placeholderData: keepPreviousData,
    // 건수를 못 받아도(오류) 목록은 `전체`로 보여 준다
    enabled: chosenStatus !== null || !count.isPending,
  });

  const review = useMutation({
    mutationFn: ({ id, status: next, adminNote }: { id: number; status: SuggestionStatus; adminNote: string }) =>
      reviewSuggestion(id, { status: next, adminNote }),
    onSuccess: async () => {
      toast(t("Admin.reviewSaved"));
      await queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  function chooseStatus(next: SuggestionStatus | "") {
    setChosenStatus(next);
    setPage(0);
    setOpenId(null);
  }

  const items = list.data?.content ?? [];
  // 데스크톱은 고르기 전에도 오른쪽 칸이 비지 않게 첫 건을 보여 준다
  const selectedId = desktop ? (items.some((item) => item.id === openId) ? openId : (items[0]?.id ?? null)) : openId;
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function renderForm(item: AdminSuggestionResponse) {
    return (
      <ReviewForm
        key={`${item.id}-${item.updatedAt}`}
        item={item}
        pending={review.isPending && review.variables?.id === item.id}
        error={review.variables?.id === item.id ? messageOf(review.error, t) : null}
        onSave={(next, adminNote) => review.mutate({ id: item.id, status: next, adminNote })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {/* 다른 관리 화면과 같은 뒤로 버튼(2026-10-27) */}
        <AdminBackLink />
        <div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-fg">{t("Admin.suggestionsTitle")}</h1>
            <PageSizeSelect
              value={size}
              onChange={(next) => {
                setSize(next);
                setPage(0);
                setOpenId(null);
              }}
            />
          </div>
          {count.data ? (
            <p className="mt-1 text-sm text-fg-sub">
              {t.rich("Admin.receivedCount", { count: count.data.received, n: (c) => <span className="font-num">{c}</span> })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChips viewerId={viewerId} category={category} status={status} onChoose={chooseStatus} />
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          {t("Suggestions.fieldCategory")}
          <select
            className={FIELD}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as SuggestionCategory | "");
              setPage(0);
              setOpenId(null);
            }}
          >
            <option value="">{t("Songs.all")}</option>
            {SUGGESTION_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {t(CATEGORY_LABELS[item])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-fg">
          {list.error instanceof ApiError ? list.error.message : t("Admin.suggestionsLoadFailed")}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Admin.suggestionsEmpty")}</p>
      ) : (
        <>
          <div className={desktop ? "grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] items-start gap-4" : undefined}>
            <ul aria-label={t("Admin.suggestionsListAria")} className="flex flex-col gap-2">
              {items.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  expanded={item.id === selectedId}
                  inline={!desktop}
                  onToggle={() => setOpenId(!desktop && item.id === openId ? null : item.id)}
                >
                  {renderForm(item)}
                </SuggestionCard>
              ))}
            </ul>
            {desktop && selected ? (
              <section aria-labelledby={`suggestion-detail-${selected.id}`} className="sticky top-4 rounded-2xl border border-line bg-card p-4">
                <h2 id={`suggestion-detail-${selected.id}`} className="mb-2 text-[17px] font-bold text-fg">
                  {selected.title}
                </h2>
                {renderForm(selected)}
              </section>
            ) : null}
          </div>
          <Pager
            page={list.data.page}
            totalPages={list.data.totalPages}
            onChange={(next) => {
              setPage(next);
              setOpenId(null);
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * 상태 칩: 접수 / 처리 완료 / 전체, 글자 옆에 개수. 색만으로 고르지 않고 눌린 칩은 aria-pressed로도 알린다.
 * 개수는 같은 목록 API를 종류 조건과 함께 한 건씩(size=1) 요청해 totalElements로 센다(새 API 없음).
 * 저장하면 suggestionKeys.all이 새로 받아지므로 개수도 같이 갱신된다.
 */
function StatusChips({
  viewerId,
  category,
  status,
  onChoose,
}: {
  viewerId: number;
  category: SuggestionCategory | "";
  status: SuggestionStatus | "";
  onChoose: (next: SuggestionStatus | "") => void;
}) {
  const t = useTranslations();
  const chips: { value: SuggestionStatus | ""; label: string }[] = [
    { value: "RECEIVED", label: t(STATUS_LABELS.RECEIVED) },
    { value: "DONE", label: t(STATUS_LABELS.DONE) },
    { value: "", label: t("Songs.all") },
  ];
  return (
    <div role="group" aria-label={t("Admin.status")} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <StatusChip
          key={chip.value || "all"}
          viewerId={viewerId}
          category={category}
          value={chip.value}
          label={chip.label}
          pressed={status === chip.value}
          onChoose={onChoose}
        />
      ))}
    </div>
  );
}

function StatusChip({
  viewerId,
  category,
  value,
  label,
  pressed,
  onChoose,
}: {
  viewerId: number;
  category: SuggestionCategory | "";
  value: SuggestionStatus | "";
  label: string;
  pressed: boolean;
  onChoose: (next: SuggestionStatus | "") => void;
}) {
  const total = useQuery({
    queryKey: [...suggestionKeys.all, "chip-count", viewerId, category, value] as const,
    queryFn: ({ signal }) => fetchAdminSuggestions({ category, status: value }, 0, 1, signal).then((r) => r.totalElements),
  });
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChoose(value)}
      className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
        pressed ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub hover:text-fg"
      }`}
    >
      {label}
      {total.data !== undefined ? <span className="ml-1.5 font-num">{total.data}</span> : null}
    </button>
  );
}

/**
 * 압축 카드: 제목, 분류·상태 태그, 보낸 사람, 날짜, 한 줄 미리보기. 머리 전체가 하나의 버튼이다(누르는 칸 44px 이상).
 * 폰(inline)에서는 펼치면 같은 카드 안에 children(상세 폼)이 나오고, aria-expanded로 알린다.
 * 데스크톱에서는 같은 버튼이 "선택"이라 상세는 오른쪽 칸에 있고, aria-current로 선택을 알린다.
 * 펼침 움직임은 기존 모션 토큰의 motion-reveal만 쓴다(새 keyframes 없음).
 */
function SuggestionCard({
  item,
  expanded,
  inline,
  onToggle,
  children,
}: {
  item: AdminSuggestionResponse;
  expanded: boolean;
  inline: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const bodyId = useId();
  // 줄바꿈·연속 공백을 한 칸으로 줄여 한 줄로 보이고, 길면 CSS(truncate)가 말줄임한다
  const preview = item.content.replace(/\s+/g, " ").trim();
  return (
    <li className={`rounded-2xl border bg-card ${expanded ? "border-ctl" : "border-line"}`}>
      <button
        type="button"
        onClick={onToggle}
        {...(inline ? { "aria-expanded": expanded, "aria-controls": bodyId } : { "aria-current": expanded })}
        className="flex min-h-11 w-full flex-col gap-1 rounded-2xl p-4 text-left"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[17px] font-bold text-fg">{item.title}</span>
          <time dateTime={item.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
            {formatPlayedDate(item.createdAt)}
          </time>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-fg-sub">
          <span>{t(CATEGORY_LABELS[item.category])}</span>
          <StatusLabel status={item.status} />
          <span>{t("Admin.sentBy", { name: item.authorNickname })}</span>
          {item.requestedPart && item.requestedDifficulty ? (
            <span>{describeChartRequest(item.requestedPart, item.requestedDifficulty)}</span>
          ) : null}
        </span>
        <span className="truncate text-sm text-fg-sub">{preview}</span>
      </button>
      {inline && expanded ? (
        <div id={bodyId} className="motion-reveal border-t border-line px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </li>
  );
}

/**
 * 상세: 전체 내용, 곡 등록 버튼(곡 추가 건의), 처리 상태 선택, 답변, 저장.
 * key에 updatedAt을 넣어, 저장이 끝나 서버 값이 바뀌면 입력 상태를 서버 값으로 다시 맞춘다.
 */
function ReviewForm({
  item,
  pending,
  error,
  onSave,
}: {
  item: AdminSuggestionResponse;
  pending: boolean;
  error: string | null;
  onSave: (status: SuggestionStatus, adminNote: string) => void;
}) {
  const t = useTranslations();
  const [status, setStatus] = useState<SuggestionStatus>(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap break-words text-sm text-fg">{item.content}</p>
      {item.category === "SONG_REQUEST" ? <RegisterSongFromSuggestion item={item} /> : null}
      <div className="flex flex-col gap-2 border-t border-line pt-2">
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          {t("Admin.status")}
          <select
            aria-label={t("Admin.statusAria", { title: item.title })}
            className={FIELD}
            value={status}
            onChange={(event) => setStatus(event.target.value as SuggestionStatus)}
          >
            {SUGGESTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(STATUS_LABELS[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-sub">
          {t("Admin.replyLabel")}
          <textarea
            aria-label={t("Admin.replyAria", { title: item.title })}
            rows={2}
            maxLength={SUGGESTION_NOTE_MAX}
            className={FIELD}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-fg">
            {error}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSave(status, note)}
            aria-label={t("Admin.reviewSaveAria", { title: item.title })}
            className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
          >
            {pending ? t("Common.saving") : t("Common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 곡 추가 건의에서 바로 곡 등록 창을 여는 버튼(ROOT·ADMIN 화면이라 권한은 이미 갖춘 사용자만 본다. 서버도 다시 검사한다).
 * 건의의 제목(곡명)과 요청 채보(파트·난이도)로 창을 미리 채워 열고, 레벨·기준 난이도 같은 값은 관리자가 직접 넣어 확정한다.
 * 자동 등록이 아니다(D35): 등록해도 건의 상태는 바꾸지 않으므로 처리 상태·답변은 관리자가 따로 저장한다.
 * 서열표 값도 바로 넣을 수 있게 레이팅 서열표 id를 가져오는데, 창을 처음 열 때만 불러온다.
 */
function RegisterSongFromSuggestion({ item }: { item: AdminSuggestionResponse }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const tables = useQuery({
    queryKey: ["difficulty-tables"],
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    enabled: asked,
  });
  // 서열표 목록이 오기 전에는 창을 열지 않는다. 늦게 오면 tableId가 바뀌면서 입력 중인 폼이 다시 만들어지기 때문이다.
  const ready = asked && !tables.isPending;
  return (
    <div>
      <button
        type="button"
        aria-label={t("Admin.registerFromSuggestionAria", { title: item.title })}
        onClick={() => {
          setAsked(true);
          setOpen(true);
        }}
        className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head"
      >
        {t("Songs.create")}
      </button>
      <SongCreateDialog
        open={open && ready}
        tableId={tables.data ? (pickRatingTable(tables.data)?.id ?? null) : null}
        initial={{
          title: item.title,
          chart: item.requestedPart && item.requestedDifficulty
            ? { part: item.requestedPart, difficulty: item.requestedDifficulty }
            : null,
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
