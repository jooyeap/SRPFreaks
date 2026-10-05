#!/usr/bin/env python3
"""
시드 CSV(곡 마스터 + 서열표 값)를 읽어 1회성 입력용 SQL(seed.sql)을 만든다. (D23)

사용: python3 scripts/seed/generate_seed_sql.py <시드.csv> [출력경로]
      기본 출력은 scripts/seed/out/seed.sql (.gitignore 대상이라 커밋되지 않는다)

설계 메모
- 서버에 CSV 업로드 기능을 두지 않는 대신, 최초 1회만 이 SQL을 DB에 직접 실행한다.
- ID를 직접 지정한다(곡 1.., 채보 1.., 서열표 1). 같은 SQL을 두 번 실행하면 PK 중복으로 실패하고,
  START TRANSACTION 안에 있으므로 중간까지 들어간 데이터 없이 전체가 롤백된다.
- 곡 묶음 기준은 곡명을 NFKC 정규화하고 공백을 제거한 값(서버의 normalized_title 규칙과 같다).
- 문자열은 작은따옴표/역슬래시를 이스케이프한다. 입력은 신뢰된 시트이지만 SQL 문자열 조립이므로
  이스케이프 함수를 한 곳에서만 쓴다.
"""
import csv
import re
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path

TABLE_NAME = "SRN+ 서열표"
NOTE_OPTION = "SUPER_RANDOM_PLUS"
PARTS = {"GUITAR", "BASS"}
DIFFS = {"BASIC", "ADVANCED", "EXTREME", "MASTER"}
RECOMMEND = {"상", "중", "하"}
PATTERNS = {"단일", "복합", "이중", "삼중", "레이팅 제외"}
BATCH = 200  # 한 INSERT에 넣을 행 수


def q(value):
    """SQL 문자열 리터럴. 비어 있으면 NULL."""
    if value is None or value == "":
        return "NULL"
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def flag(value):
    return "TRUE" if value.strip().lower() in ("1", "true", "y", "yes", "o") else "FALSE"


def dec(value, field, line, places):
    if value == "":
        return "NULL"
    try:
        d = Decimal(value)
    except InvalidOperation:
        raise SystemExit(f"{line}행: {field} 값이 숫자가 아닙니다: {value!r}")
    return str(d.quantize(Decimal(1).scaleb(-places)))


def norm(title):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", title)).lower()


def choice(value, allowed, field, line):
    if value != "" and value not in allowed:
        raise SystemExit(f"{line}행: {field} 값이 올바르지 않습니다: {value!r}")
    return value


def batched(table, columns, rows):
    out = []
    for i in range(0, len(rows), BATCH):
        chunk = rows[i:i + BATCH]
        out.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n  "
                   + ",\n  ".join("(" + ", ".join(r) + ")" for r in chunk) + ";")
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / "out" / "seed.sql"

    songs = {}      # normalized title -> [id, title, added_version, source]
    diffs = {}      # (song_id, part, difficulty) -> chart row
    entries = []

    with src.open(encoding="utf-8-sig", newline="") as f:
        for n, row in enumerate(csv.DictReader(f), start=2):
            title = unicodedata.normalize("NFKC", row["title"]).replace("\r", "").replace("\n", "").strip()
            if not title:
                raise SystemExit(f"{n}행: title이 비어 있습니다.")
            part = choice(row["part"].strip().upper(), PARTS, "part", n)
            diff = choice(row["difficulty"].strip().upper(), DIFFS, "difficulty", n)
            if not part or not diff:
                raise SystemExit(f"{n}행: part/difficulty는 필수입니다.")
            level = dec(row["level"].strip(), "level", n, 2)
            if level == "NULL":
                raise SystemExit(f"{n}행: level은 필수입니다.")
            tier = dec(row["tier_label"].strip(), "tier_label", n, 1)
            rec = choice(row["recommend"].strip(), RECOMMEND, "recommend", n)
            pat = choice(row["pattern_type"].strip(), PATTERNS, "pattern_type", n)

            key = norm(title)
            if key not in songs:
                songs[key] = [len(songs) + 1, title, row["added_version"].strip(), row["source"].strip()]
            song_id = songs[key][0]

            ckey = (song_id, part, diff)
            if ckey in diffs:
                raise SystemExit(f"{n}행: 같은 곡·파트·난이도가 중복됩니다: {title} {part} {diff}")
            diff_id = len(diffs) + 1
            diffs[ckey] = [diff_id, song_id, part, diff, level]
            entries.append([str(len(entries) + 1), "1", str(diff_id), tier,
                            flag(row["tier_uncertain"]), q(rec), flag(row["recommend_uncertain"]),
                            q(pat), flag(row["pattern_uncertain"])])

    now = "UTC_TIMESTAMP(6)"
    song_rows = [[str(i), q(t), q(v), q(s), "FALSE", now, now] for i, t, v, s in songs.values()]
    diff_rows = [[str(d[0]), str(d[1]), q(d[2]), q(d[3]), d[4], "FALSE", now, now] for d in diffs.values()]
    entry_rows = [e + [now, now] for e in entries]

    parts = [
        "-- 자동 생성 파일입니다. 직접 고치지 말고 generate_seed_sql.py로 다시 만드세요. (D23)",
        "-- 최초 1회만 실행합니다. 두 번 실행하면 PK 중복으로 실패하고 전체가 롤백됩니다.",
        "SET NAMES utf8mb4;",
        "START TRANSACTION;",
        batched("songs", ["song_id", "title", "added_version", "source", "is_deleted", "created_at", "updated_at"], song_rows),
        batched("song_difficulties", ["song_difficulty_id", "song_id", "instrument_part", "difficulty_type", "level",
                                      "is_deleted", "created_at", "updated_at"], diff_rows),
        f"INSERT INTO difficulty_tables (difficulty_table_id, name, instrument_part, note_option, status, revision, created_at, updated_at)\n"
        f"VALUES (1, {q(TABLE_NAME)}, NULL, {q(NOTE_OPTION)}, 'ACTIVE', 1, {now}, {now});",
        batched("difficulty_table_entries",
                ["difficulty_table_entry_id", "difficulty_table_id", "song_difficulty_id", "tier_label", "tier_uncertain",
                 "recommend", "recommend_uncertain", "pattern_type", "pattern_uncertain", "created_at", "updated_at"],
                entry_rows),
        "COMMIT;",
        "",
    ]
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("\n".join(parts), encoding="utf-8", newline="\n")
    print(f"곡 {len(songs)}개, 채보 {len(diffs)}개, 서열표 1개, 서열표 항목 {len(entries)}개 -> {dst}")


if __name__ == "__main__":
    main()
