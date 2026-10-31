package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ImportPlayRequest;
import com.srpfreaks.backend.dto.ImportPlayResult;
import com.srpfreaks.backend.dto.ImportRecentPlaysRequest;
import com.srpfreaks.backend.dto.ImportResultResponse;
import com.srpfreaks.backend.dto.ImportSkipReason;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.Platform;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.RecordBest;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 공식 최근 플레이 가져오기(D34, DESIGN.md 18.4.0).
 *
 * 서버는 공식 사이트와 통신하지 않는다. 사용자 브라우저가 열어 둔 페이지에서 읽은 원시 값만 받아서 아래 순서로 걸러 저장한다.
 *  1) 게임 종류(gf) → 번역 여부 → 옵션(SRN+ + BUTTON OFF + AUTO OFF 정확히) → 난이도 클래스 → 곡 목록(마스터) 매칭
 *  2) 같은 채보가 여럿이면 달성률이 높은 것부터 처리한다
 *  3) 내 기존 최고 기록보다 낮으면 저장하지 않는다(같으면 풀콤보를 새로 얻을 때만 저장)
 * 마스터에 없는 곡은 자동으로 만들지 않고 건너뛰고 곡명을 알려 준다.
 * 모든 작업의 사용자는 인증에서 정해진 userId뿐이다(요청에 사용자 id를 받지 않는다). 가져오기 토큰 경로와 로그인 계정용 `record-imports`(미리보기·저장)가 이 서비스를 같이 쓴다.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    static final String GAME_TYPE = "gf";
    /** 받는 옵션: S.RANDOM+(gf_random_5) + BUTTON OFF(gf_button_1) + AUTO OFF(gf_auto_1). 이 셋이 정확히 있어야 한다 */
    static final Set<String> SRN_PLUS_OPTIONS = Set.of("gf_random_5", "gf_button_1", "gf_auto_1");
    static final NoteOption SAVED_OPTION = NoteOption.SUPER_RANDOM_PLUS;
    /** 공식 달성률은 x100 정수로 온다. 100.00% = 10000 */
    private static final int MAX_RATE_X100 = 10_000;
    /** 시계가 조금 어긋난 기기를 봐주는 여유. 이보다 미래의 플레이 시각은 받지 않는다 */
    private static final Duration FUTURE_TOLERANCE = Duration.ofDays(1);

    /**
     * 읽는 난이도 클래스. 구조는 `{gf|bass}_{bsc|adv|ext|mst}`다. mst는 샘플로 확인했고, 드럼의 `dm_ext`·`dm_adv`로
     * 같은 구조임을 확인해 나머지를 같은 규칙으로 추가했다. 기타/베이스의 bsc·adv·ext 값은 실제 플레이로 재확인한다(DESIGN.md 18.4.0).
     * 모르는 클래스는 UNKNOWN_DIFFICULTY로 건너뛰므로, 이름이 다르면 저장되지 않을 뿐 다른 채보로 잘못 저장되지는 않는다.
     */
    private static final Map<String, ChartKey> DIFFICULTY_CLASSES = Map.of(
            "gf_bsc", new ChartKey(InstrumentPart.GUITAR, DifficultyType.BASIC),
            "gf_adv", new ChartKey(InstrumentPart.GUITAR, DifficultyType.ADVANCED),
            "gf_ext", new ChartKey(InstrumentPart.GUITAR, DifficultyType.EXTREME),
            "gf_mst", new ChartKey(InstrumentPart.GUITAR, DifficultyType.MASTER),
            "bass_bsc", new ChartKey(InstrumentPart.BASS, DifficultyType.BASIC),
            "bass_adv", new ChartKey(InstrumentPart.BASS, DifficultyType.ADVANCED),
            "bass_ext", new ChartKey(InstrumentPart.BASS, DifficultyType.EXTREME),
            "bass_mst", new ChartKey(InstrumentPart.BASS, DifficultyType.MASTER));

    record ChartKey(InstrumentPart part, DifficultyType difficulty) {
    }

    /** 걸러내기를 통과한 한 건(저장 후보). */
    private record Candidate(int index, ImportPlayRequest play, SongDifficulty chart, BigDecimal rate, boolean fullCombo,
                             Instant playedAt) {
    }

    private final SongDifficultyRepository songDifficultyRepository;
    private final SongTitleRepository songTitleRepository;
    private final OptionRecordRepository optionRecordRepository;
    private final UserRepository userRepository;
    private final RivalAlertTrigger rivalAlertTrigger;
    private final Clock clock;

    /** 가져오기 토큰 경로와 저장 API가 쓴다: 걸러서 실제로 저장한다. */
    @Transactional
    public ImportResultResponse importRecentPlays(Long userId, ImportRecentPlaysRequest request) {
        return process(userId, request, true);
    }

    /**
     * 미리보기: 저장과 같은 규칙으로 걸러서 건별 결과만 돌려주고 아무것도 저장하지 않는다(읽기 전용 트랜잭션).
     * 결과의 saved는 "지금 저장하면 저장될 건"이다. 저장 API는 요청을 다시 같은 규칙으로 검증하므로 미리보기 값을 믿지 않는다.
     */
    @Transactional(readOnly = true)
    public ImportResultResponse previewRecentPlays(Long userId, ImportRecentPlaysRequest request) {
        return process(userId, request, false);
    }

    private ImportResultResponse process(Long userId, ImportRecentPlaysRequest request, boolean commit) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        Instant now = clock.instant();
        List<ImportPlayRequest> plays = request.plays();

        ChartIndex index = new ChartIndex(songDifficultyRepository.findAllActiveWithSong());
        ImportPlayResult[] results = new ImportPlayResult[plays.size()];
        List<Candidate> candidates = new ArrayList<>();
        Set<String> excluded = new LinkedHashSet<>();

        for (int i = 0; i < plays.size(); i++) {
            ImportPlayRequest play = plays.get(i);
            ImportSkipReason reason = null;
            ChartKey key = DIFFICULTY_CLASSES.get(play.difficultyClass());
            SongDifficulty chart = null;
            if (!GAME_TYPE.equals(play.gameType())) {
                reason = ImportSkipReason.UNSUPPORTED_GAME_TYPE;
            } else if (play.translated()) {
                reason = ImportSkipReason.TRANSLATED_PAGE;
            } else if (!isSupportedOptions(play.options())) {
                reason = ImportSkipReason.OPTION_NOT_SUPPORTED;
            } else if (key == null) {
                reason = ImportSkipReason.UNKNOWN_DIFFICULTY;
            } else if (Instant.ofEpochMilli(play.playedAtMs()).isAfter(now.plus(FUTURE_TOLERANCE))) {
                reason = ImportSkipReason.INVALID_VALUE;
            } else {
                Set<Long> songIds = songIdsOf(index, play.title());
                if (songIds.size() > 1) {
                    reason = ImportSkipReason.AMBIGUOUS_SONG;
                } else {
                    chart = songIds.isEmpty() ? null : index.chart(songIds.iterator().next(), key);
                    if (chart == null) {
                        reason = ImportSkipReason.SONG_NOT_FOUND;
                    }
                }
                if (reason != null) {
                    excluded.add(play.title());
                }
            }
            if (reason != null) {
                results[i] = new ImportPlayResult(i, play.title(), false, reason);
                continue;
            }
            BigDecimal rate = BigDecimal.valueOf(play.rate(), 2);
            candidates.add(new Candidate(i, play, chart, rate, isFullCombo(play), Instant.ofEpochMilli(play.playedAtMs())));
        }

        saveImproved(user, candidates, results, commit);

        List<ImportPlayResult> list = List.of(results);
        Map<ImportSkipReason, Integer> byReason = new EnumMap<>(ImportSkipReason.class);
        int saved = 0;
        for (ImportPlayResult r : list) {
            if (r.saved()) {
                saved++;
            } else {
                byReason.merge(r.reason(), 1, Integer::sum);
            }
        }
        return new ImportResultResponse(saved, list.size() - saved, byReason, list, List.copyOf(excluded));
    }

    /**
     * 같은 채보 안에서 달성률 높은 순(같으면 풀콤보 먼저, 그다음 이른 플레이)으로 처리하며 "내 최고 기록"을 메모리에서 같이 갱신한다.
     * 그래서 한 요청 안에 같은 채보가 여러 번 있어도 가장 높은 하나만 저장되고 나머지는 낮음/개선 없음으로 걸러진다.
     *
     * 비교 대상은 곡 목록·서열표와 같은 "대표 기록"(findBestByUser: 최고 달성률, 하나라도 FC면 FC)이다.
     * 풀콤보는 기록 전체에서 한 번이라도 얻었으면 단계(FC)에 이미 반영돼 있으므로, 같은 달성률에서는 FC를 새로 얻을 때만 저장한다.
     */
    private void saveImproved(User user, List<Candidate> candidates, ImportPlayResult[] results, boolean commit) {
        Map<Long, RecordBest> bests = new HashMap<>();
        optionRecordRepository.findBestByUser(user.getId(), SAVED_OPTION).forEach(b -> bests.put(b.songDifficultyId(), b));

        List<Candidate> ordered = new ArrayList<>(candidates);
        ordered.sort(Comparator
                .comparing((Candidate c) -> c.chart().getId())
                .thenComparing(Candidate::rate, Comparator.reverseOrder())
                .thenComparing(Candidate::fullCombo, Comparator.reverseOrder())
                .thenComparing(Candidate::playedAt));

        for (Candidate c : ordered) {
            Long chartId = c.chart().getId();
            RecordBest best = bests.get(chartId);
            ImportSkipReason reason = null;
            if (best != null) {
                int cmp = c.rate().compareTo(best.bestRate());
                if (cmp < 0) {
                    reason = ImportSkipReason.LOWER_THAN_BEST;
                } else if (cmp == 0 && !(c.fullCombo() && !best.fullCombo())) {
                    reason = ImportSkipReason.NOT_IMPROVED;
                }
            }
            BigDecimal previous = best == null ? null : best.bestRate();
            if (reason != null) {
                results[c.index()] = new ImportPlayResult(c.index(), c.play().title(), false, reason, previous);
                continue;
            }
            if (commit) {
                optionRecordRepository.save(OptionRecord.create(user, c.chart(), SAVED_OPTION, c.rate(), c.fullCombo(),
                        c.playedAt(), Platform.ARCADE, null));
                // 라이벌 역전 알림(D56): 이전 최고(없으면 첫 기록이라 알림 없음) → 새 최고
                rivalAlertTrigger.recordSaved(user.getId(), chartId, SAVED_OPTION, previous,
                        previous == null ? c.rate() : previous.max(c.rate()));
            }
            bests.put(chartId, new RecordBest(chartId,
                    best == null ? c.rate() : best.bestRate().max(c.rate()), c.fullCombo() || (best != null && best.fullCombo())));
            results[c.index()] = new ImportPlayResult(c.index(), c.play().title(), true, null, previous);
        }
    }

    /** 옵션 클래스가 SRN+ + BUTTON OFF + AUTO OFF 셋과 정확히 같은가(더 있거나 덜 있어도 받지 않는다). */
    static boolean isSupportedOptions(List<String> options) {
        return options != null && options.size() == SRN_PLUS_OPTIONS.size() && new HashSet<>(options).equals(SRN_PLUS_OPTIONS);
    }

    /**
     * 풀콤보 판정(D34): 달성률 100.00(EXC)이면 true, 아니면 MISS와 OK가 모두 0일 때 true.
     * OK가 있으면 공식에서도 풀콤보로 처리되지 않는다(사용자 확인). 클리어 칸 클래스는 샘플 확인 후 보조로 쓸지 정한다.
     */
    static boolean isFullCombo(ImportPlayRequest play) {
        return play.rate() >= MAX_RATE_X100 || (play.miss() == 0 && play.ok() == 0);
    }

    /** 곡명(정규화)으로 곡을 찾는다. 곡 제목이 같은 곡을 먼저 보고, 없으면 표기·별칭(song_titles)으로 찾는다. */
    private Set<Long> songIdsOf(ChartIndex index, String title) {
        String normalized = SongTitle.normalize(title);
        Set<Long> ids = index.songIdsByTitle(normalized);
        if (!ids.isEmpty()) {
            return ids;
        }
        Set<Long> viaAlias = new HashSet<>();
        for (SongTitle t : songTitleRepository.findByNormalizedTitle(normalized)) {
            // 삭제된 곡의 표기는 채보 색인에 없으므로 자연스럽게 빠진다
            if (index.hasSong(t.getSong().getId())) {
                viaAlias.add(t.getSong().getId());
            }
        }
        return viaAlias;
    }

    /** 삭제되지 않은 채보를 곡 제목(정규화)과 (곡, 파트, 난이도)로 찾기 위한 색인. 채보 수백 개를 한 번에 읽어 메모리에서 찾는다. */
    private static final class ChartIndex {
        private final Map<String, Set<Long>> songIdsByTitle = new HashMap<>();
        private final Map<Long, Map<ChartKey, SongDifficulty>> chartsBySong = new HashMap<>();

        ChartIndex(List<SongDifficulty> charts) {
            for (SongDifficulty d : charts) {
                Long songId = d.getSong().getId();
                songIdsByTitle.computeIfAbsent(SongTitle.normalize(d.getSong().getTitle()), k -> new HashSet<>()).add(songId);
                chartsBySong.computeIfAbsent(songId, k -> new HashMap<>())
                        .put(new ChartKey(d.getInstrumentPart(), d.getDifficultyType()), d);
            }
        }

        Set<Long> songIdsByTitle(String normalizedTitle) {
            return songIdsByTitle.getOrDefault(normalizedTitle, Set.of());
        }

        boolean hasSong(Long songId) {
            return chartsBySong.containsKey(songId);
        }

        SongDifficulty chart(Long songId, ChartKey key) {
            Map<ChartKey, SongDifficulty> charts = chartsBySong.get(songId);
            return charts == null ? null : charts.get(key);
        }
    }
}
