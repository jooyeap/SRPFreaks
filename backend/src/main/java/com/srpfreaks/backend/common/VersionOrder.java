package com.srpfreaks.backend.common;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * 곡 목록 버전 필터(versions)의 정렬 기준: GITADORA 시리즈 출시일(일본 아케이드) 내림차순.
 *
 * <p>왜 상수 클래스인가: songs.added_version 은 자유 입력 문자열이고, 새 버전은 1~2년에 한 번 나온다.
 * 설정(app_settings)이나 테이블로 만들면 관리 화면까지 필요해지므로, 새 버전이 나오면 {@link #TABLE} 에 한 줄만 추가한다.
 *
 * <p>이름 비교 규칙(contains 금지): {@link #normalize} 로 만든 값이 <b>완전히 같을 때만</b> 같은 버전으로 본다.
 * 그래서 {@code GALAXY WAVE} 와 {@code GALAXY WAVE DELTA} 는 서로 다른 버전이다.
 * 표에 없는 이름은 필터에서 사라지지 않고 목록 맨 아래에 이름 순으로 붙는다. 표시 이름은 DB 값 그대로다.
 */
public final class VersionOrder {

    private record Entry(LocalDate releaseDate, String name, String... aliases) {
    }

    /**
     * 이름, 출시일, 별칭. 출시일은 일본 아케이드 기준(영문·일문 위키백과·RemyWiki). 모르는 버전에 임의 날짜를 넣지 않는다.
     * 운영 값이 약칭일 수 있어 약칭 별칭을 둔다(2026-11-11, 예: {@code GW DELTA}).
     * 모호한 약칭은 넣지 않는다: {@code NA}(NEX+AGE, 하지만 {@code N/A} 와 같아짐), {@code EX}, {@code GD} 등.
     */
    private static final List<Entry> TABLE = List.of(
            new Entry(LocalDate.of(1999, 2, 16), "GuitarFreaks 1st Mix", "1st Mix", "1stMix"),
            new Entry(LocalDate.of(1999, 7, 10), "GuitarFreaks 2ndMix / DrumMania 1st Mix", "GuitarFreaks 2nd Mix", "2nd Mix", "2ndMix"),
            new Entry(LocalDate.of(2000, 4, 21), "GuitarFreaks 3rdMix & DrumMania 2ndMix", "GuitarFreaks 3rd Mix", "3rd Mix", "3rdMix"),
            new Entry(LocalDate.of(2000, 9, 13), "GuitarFreaks 4thMix & DrumMania 3rdMix", "GuitarFreaks 4th Mix", "4th Mix", "4thMix"),
            new Entry(LocalDate.of(2001, 3, 17), "GuitarFreaks 5thMix & DrumMania 4thMix", "GuitarFreaks 5th Mix", "5th Mix", "5thMix"),
            new Entry(LocalDate.of(2001, 9, 13), "GuitarFreaks 6thMix & DrumMania 5thMix", "GuitarFreaks 6th Mix", "6th Mix", "6thMix"),
            new Entry(LocalDate.of(2002, 2, 28), "GuitarFreaks 7thMix & DrumMania 6thMix", "GuitarFreaks 7th Mix", "7th Mix", "7thMix"),
            new Entry(LocalDate.of(2002, 8, 30), "GuitarFreaks 8thMix & DrumMania 7thMix", "GuitarFreaks 8th Mix", "8th Mix", "8thMix"),
            new Entry(LocalDate.of(2003, 4, 2), "GuitarFreaks 9thMix & DrumMania 8thMix", "GuitarFreaks 9th Mix", "9th Mix", "9thMix"),
            new Entry(LocalDate.of(2003, 10, 8), "GuitarFreaks 10thMix & DrumMania 9thMix", "GuitarFreaks 10th Mix", "10th Mix", "10thMix"),
            new Entry(LocalDate.of(2004, 4, 22), "GuitarFreaks 11thMix & DrumMania 10thMix", "GuitarFreaks 11th Mix", "11th Mix", "11thMix"),
            new Entry(LocalDate.of(2005, 2, 23), "GuitarFreaks & DrumMania V", "V", "GuitarFreaks V"),
            new Entry(LocalDate.of(2005, 11, 24), "GuitarFreaks & DrumMania V2", "V2", "GuitarFreaks V2"),
            new Entry(LocalDate.of(2006, 9, 13), "GuitarFreaks & DrumMania V3", "V3", "GuitarFreaks V3"),
            new Entry(LocalDate.of(2007, 8, 8), "GuitarFreaks & DrumMania V4", "V4", "GuitarFreaks V4", "V4 (RockxRock)", "RockxRock"),
            new Entry(LocalDate.of(2008, 6, 18), "GuitarFreaks & DrumMania V5", "V5", "GuitarFreaks V5", "V5 (Rock to Infinity)", "Rock to Infinity"),
            new Entry(LocalDate.of(2009, 4, 9), "GuitarFreaks & DrumMania V6", "V6", "GuitarFreaks V6", "V6 (Blazing!)", "Blazing!"),
            new Entry(LocalDate.of(2010, 3, 10), "GuitarFreaks XG", "XG", "GuitarFreaks & DrumMania XG"),
            new Entry(LocalDate.of(2010, 3, 25), "GuitarFreaks & DrumMania V7", "V7", "GuitarFreaks V7"),
            new Entry(LocalDate.of(2011, 3, 9), "GuitarFreaks XG2", "XG2", "XG2 (Groove to Live)", "Groove to Live", "GuitarFreaks & DrumMania XG2"),
            new Entry(LocalDate.of(2011, 3, 28), "GuitarFreaks & DrumMania V8", "V8", "GuitarFreaks V8"),
            new Entry(LocalDate.of(2012, 2, 23), "GuitarFreaks XG3", "XG3", "GuitarFreaks & DrumMania XG3"),
            new Entry(LocalDate.of(2013, 2, 14), "GITADORA"),
            new Entry(LocalDate.of(2014, 3, 5), "GITADORA OverDrive", "OverDrive", "OD"),
            new Entry(LocalDate.of(2015, 4, 21), "GITADORA Tri-Boost", "Tri-Boost", "TB"),
            new Entry(LocalDate.of(2016, 12, 14), "GITADORA Tri-Boost Re:EVOLVE", "Tri-Boost Re:EVOLVE", "Re:EVOLVE", "TB Re:EVOLVE"),
            new Entry(LocalDate.of(2017, 9, 6), "GITADORA Matixx", "Matixx"),
            new Entry(LocalDate.of(2018, 9, 12), "GITADORA EXCHAIN", "EXCHAIN"),
            new Entry(LocalDate.of(2019, 10, 2), "GITADORA NEX+AGE", "NEX+AGE"),
            new Entry(LocalDate.of(2021, 4, 21), "GITADORA HIGH-VOLTAGE", "HIGH-VOLTAGE", "HV"),
            new Entry(LocalDate.of(2022, 12, 14), "GITADORA FUZZ-UP", "FUZZ-UP", "FU"),
            new Entry(LocalDate.of(2024, 3, 13), "GITADORA GALAXY WAVE", "GALAXY WAVE", "GW", "GITADORA GW"),
            // 한국 출시는 2025-04-25 이지만 순서에는 영향이 없어 일본 기준을 쓴다.
            new Entry(LocalDate.of(2025, 3, 17), "GITADORA GALAXY WAVE DELTA", "GALAXY WAVE DELTA", "GW DELTA", "GITADORA GW DELTA"));

    /** 정규화한 이름 → 출시일. 이름과 별칭을 모두 넣는다. */
    private static final Map<String, LocalDate> DATE_BY_KEY = buildIndex();

    private VersionOrder() {
    }

    private static Map<String, LocalDate> buildIndex() {
        Map<String, LocalDate> index = new HashMap<>();
        for (Entry e : TABLE) {
            put(index, e.name(), e.releaseDate());
            for (String alias : e.aliases()) {
                put(index, alias, e.releaseDate());
            }
        }
        return Map.copyOf(index);
    }

    private static void put(Map<String, LocalDate> index, String name, LocalDate date) {
        LocalDate previous = index.put(normalize(name), date);
        // 같은 키가 서로 다른 날짜를 가리키면 표 오류다. 시작 시점에 바로 드러나게 한다.
        if (previous != null && !previous.equals(date)) {
            throw new IllegalStateException("버전 이름이 겹칩니다: " + name);
        }
    }

    /** NFKC → 글자·숫자만 남김(공백·하이픈·콜론·기호 제거) → 소문자. 예: {@code Tri-Boost Re:EVOLVE} = {@code TriBoost ReEvolve}. */
    static String normalize(String name) {
        // 그리스 문자 Δ(U+0394)·증분 기호 ∆(U+2206)는 DELTA 로 본다. 안 하면 ∆ 는 기호라 지워져 GALAXY WAVE 와 같아진다.
        String nfkc = Normalizer.normalize(name, Normalizer.Form.NFKC).replace("Δ", "DELTA").replace("∆", "DELTA");
        StringBuilder sb = new StringBuilder(nfkc.length());
        nfkc.codePoints().filter(Character::isLetterOrDigit).forEach(sb::appendCodePoint);
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    /** 표에 있는 버전이면 출시일, 아니면 empty. */
    public static Optional<LocalDate> releaseDate(String name) {
        if (name == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(DATE_BY_KEY.get(normalize(name)));
    }

    /**
     * 출시일이 최신인 버전이 위. 같은 날짜는 이름 순, 표에 없는 값은 맨 아래에 이름 순.
     * null·빈 값은 제외하고 중복은 제거한다. 표시 이름은 입력 그대로다.
     */
    public static List<String> sorted(Collection<String> names) {
        List<String> distinct = new ArrayList<>(names.stream()
                .filter(v -> v != null && !v.isBlank())
                .distinct()
                .toList());
        // 출시일 내림차순(없는 값은 맨 뒤) → 이름 순
        Comparator<String> byDateDesc = Comparator.comparing(
                (String v) -> releaseDate(v).orElse(null),
                Comparator.nullsLast(Comparator.reverseOrder()));
        distinct.sort(byDateDesc.thenComparing(Comparator.naturalOrder()));
        return distinct;
    }
}
