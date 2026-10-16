package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongSuggestionResponse;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongRepository.SongText;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 곡 검색 오타 보정 ("혹시 이 곡인가요?"). 일반 검색(LIKE)이 아무것도 못 찾았을 때 화면이 부른다.
 *
 * 방법: 입력과 곡명(본명 + 표기·별칭)을 같은 방식으로 "접는다"(fold) — 전각/반각 통일, 소문자, 공백·기호 제거,
 * 히라가나를 가타카나로 — 그리고 입력이 곡명의 어느 부분과든 편집 거리(글자 추가·삭제·바꿈 횟수) 몇 번 안쪽으로 비슷하면 후보로 삼는다.
 * 부분 일치(Sellers 알고리즘)라서 곡명 일부만 쳐도 되고, 허용 거리는 입력이 짧을수록 엄격하다(2~3글자는 오타 허용 0).
 * 곡이 수천 개 규모라 DB에 새 컬럼·인덱스를 두지 않고 메모리에서 비교한다. 결과는 최대 {@value #MAX_RESULTS}곡이라 페이지네이션 대상이 아니다.
 * 한글 발음(예: 스테라)은 한국어 표기·별칭(song_titles)에 등록된 것만 찾는다 — 발음을 추측해 변환하지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongSuggestService {

    static final int MAX_RESULTS = 5;
    static final int MIN_QUERY_LENGTH = 2;
    /** 입력이 너무 길면(붙여넣은 문장 등) 비교 비용만 커지므로 앞부분만 쓴다. */
    static final int MAX_QUERY_LENGTH = 40;

    private final SongRepository songRepository;

    public List<SongSuggestionResponse> suggest(String rawQuery) {
        String query = fold(rawQuery);
        if (query.codePointCount(0, query.length()) < MIN_QUERY_LENGTH) {
            return List.of();
        }
        if (query.length() > MAX_QUERY_LENGTH) {
            query = query.substring(0, MAX_QUERY_LENGTH);
        }
        int allowed = allowedDistance(query.length());

        // 곡마다 가장 잘 맞은 표기 하나만 남긴다
        Map<Long, Match> best = new HashMap<>();
        Map<Long, String> titles = new HashMap<>();
        for (SongText t : songRepository.findAllTitles()) {
            titles.put(t.songId(), t.text());
            consider(best, t, query, allowed);
        }
        for (SongText t : songRepository.findAllAliasTitles()) {
            consider(best, t, query, allowed);
        }
        if (best.isEmpty()) {
            return List.of();
        }
        List<Match> ranked = new ArrayList<>(best.values());
        ranked.sort(Comparator.comparingInt(Match::distance).thenComparing(m -> titles.getOrDefault(m.songId(), "")));
        List<SongSuggestionResponse> result = new ArrayList<>();
        for (Match m : ranked.subList(0, Math.min(MAX_RESULTS, ranked.size()))) {
            Song song = songRepository.findByIdAndDeletedFalse(m.songId()).orElse(null);
            if (song != null) {
                result.add(new SongSuggestionResponse(song.getId(), song.getTitle(), song.getArtist(), m.text()));
            }
        }
        return result;
    }

    private void consider(Map<Long, Match> best, SongText t, String query, int allowed) {
        int distance = substringDistance(query, fold(t.text()));
        if (distance > allowed) {
            return;
        }
        Match current = best.get(t.songId());
        if (current == null || distance < current.distance()) {
            best.put(t.songId(), new Match(t.songId(), t.text(), distance));
        }
    }

    private record Match(Long songId, String text, int distance) {
    }

    /** 입력 길이별 허용 편집 거리: 2~3글자 0, 4~7글자 1, 8글자 이상 2. 짧은 입력은 오타 보정을 하면 엉뚱한 곡이 너무 많이 걸린다. */
    static int allowedDistance(int length) {
        if (length <= 3) {
            return 0;
        }
        return length <= 7 ? 1 : 2;
    }

    /**
     * 비교용으로 접는다: NFKC(전각·반각 통일) → 소문자 → 글자·숫자가 아닌 것(공백, 기호) 제거 → 히라가나를 가타카나로.
     * 기호를 지우므로 `Prog for your Soul`, `prog-for-your-soul`, `PROG FOR YOUR SOUL!`이 같아진다.
     */
    static String fold(String text) {
        if (text == null) {
            return "";
        }
        String nfkc = Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        StringBuilder sb = new StringBuilder(nfkc.length());
        nfkc.codePoints().forEach(cp -> {
            if (!Character.isLetterOrDigit(cp)) {
                return;
            }
            // 히라가나(U+3041~U+3096) -> 가타카나(+0x60)
            sb.appendCodePoint(cp >= 0x3041 && cp <= 0x3096 ? cp + 0x60 : cp);
        });
        return sb.toString();
    }

    /**
     * query가 text의 어느 부분 문자열과 가장 비슷한지의 편집 거리(Sellers 알고리즘: 편집 거리 표의 첫 행을 0으로 두어
     * text 안의 어디서 시작해도 비용이 들지 않게 한다). 완전히 포함되면 0.
     */
    static int substringDistance(String query, String text) {
        int m = query.length();
        int n = text.length();
        if (m == 0) {
            return 0;
        }
        int[] prev = new int[m + 1];
        int[] cur = new int[m + 1];
        for (int i = 0; i <= m; i++) {
            prev[i] = i; // 열 0: text를 0글자 쓴 상태에서 query i글자를 맞추려면 i번 삽입
        }
        int best = m;
        for (int j = 1; j <= n; j++) {
            cur[0] = 0; // text 어디서든 시작 가능
            char tc = text.charAt(j - 1);
            for (int i = 1; i <= m; i++) {
                int cost = query.charAt(i - 1) == tc ? 0 : 1;
                cur[i] = Math.min(Math.min(cur[i - 1] + 1, prev[i] + 1), prev[i - 1] + cost);
            }
            best = Math.min(best, cur[m]);
            int[] swap = prev;
            prev = cur;
            cur = swap;
        }
        return best;
    }
}
