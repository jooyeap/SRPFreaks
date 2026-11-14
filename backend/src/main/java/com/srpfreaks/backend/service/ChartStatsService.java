package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ChartStatsResponse.Chart;
import com.srpfreaks.backend.dto.ChartStatsResponse.DeviationRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.FolderRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Meta;
import com.srpfreaks.backend.dto.ChartStatsResponse.Page;
import com.srpfreaks.backend.dto.ChartStatsResponse.PlayerRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.PopularityRow;
import com.srpfreaks.backend.dto.ChartStatsResponse.Summary;
import com.srpfreaks.backend.dto.ChartStatsResponse.UndecidedRow;
import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.TableStatus;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.ChartAggregateRow;
import com.srpfreaks.backend.mapper.ChartInfoRow;
import com.srpfreaks.backend.mapper.ChartPlayerRow;
import com.srpfreaks.backend.mapper.ChartStatsMapper;
import com.srpfreaks.backend.mapper.FolderChartCountRow;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.ChartStatsCalculator.ChartAvg;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * 서열표 분석(D77): 관리자가 플레이어 기록을 근거로 서열표를 조정하도록 곡별 숫자를 보여 준다. 읽기 전용이고 아무것도 저장하지 않는다(감사 로그도 쓰지 않는다).
 * "쉬움/어려움 후보", "역전", "적정" 같은 판정은 만들지 않는다. 숫자와 정렬만 있다. 판정은 관리자가 한다.
 *
 * 집계 대상(타협 없음): 공개(profile_public) + ACTIVE 유저의 SRN+ 기록만. 비공개 유저는 어떤 목록·인원·평균에도 읽히지 않는다(ChartStatsMapper의 한 조각).
 * 유저가 한 채보에 여러 번 저장해도 평균에는 그 유저의 최고 달성률 1개만 들어간다. 계산 정의는 {@link ChartStatsCalculator}에 있다.
 *
 * 권한: 컨트롤러의 @PreAuthorize와 주소 규칙(/api/v1/admin/**)에 더해 여기서도 한 번 더 확인한다(토큰의 역할이 아니라 DB의 현재 역할·상태).
 * 그래서 역할이 막 내려갔거나 차단된 계정은 토큰이 남아 있어도 읽을 수 없다.
 *
 * 성능: 채보가 수백 개라서 채보별 집계를 한 번 읽고 폴더 평균·정렬·페이지는 메모리에서 한다. 유저별 총점·티어는 후보 쿼리 한 번(SkillService.ratedBatch)이라
 * 유저 수와 상관없이 쿼리 수가 같다(N+1 없음).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChartStatsService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 100;
    /** "최근 7일 증가분"의 기간(일). 오늘을 포함한 달력 7일(Asia/Seoul)이다. */
    public static final int RECENT_DAYS = 7;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 허용하는 정렬 값(화이트리스트). 이 밖의 값은 400이다. */
    public static final Set<String> DEVIATION_SORTS = Set.of("deviation", "avg", "players");
    public static final Set<String> POPULARITY_RANGES = Set.of("all", "7d");
    public static final Set<String> PLAYER_SORTS = Set.of("rate", "score", "plays");

    private final UserRepository userRepository;
    private final ChartStatsMapper statsMapper;
    private final SkillService skillService;
    private final DifficultyTableRepository difficultyTableRepository;
    private final Clock clock;

    // ---- 목록 --------------------------------------------------------------------------------------

    /**
     * 편차 목록: 서열표 기준 난이도가 있는 채보. 편차 = 곡 평균 - 폴더 평균.
     * 정렬 deviation = 편차의 절대값이 큰 순(폴더 평균에서 많이 벗어난 순, 부호는 화면에 +/-로 나온다), avg = 평균 높은 순, players = 플레이어 많은 순.
     * 표본 부족(값이 null)은 deviation·avg 정렬에서 맨 아래로 간다. 같으면 플레이어 수 → 채보 id 순이라 순서가 요청마다 바뀌지 않는다.
     */
    public Page<DeviationRow> deviation(Long actorId, String sort, int page, int size) {
        requireAdmin(actorId);
        String key = sort == null || sort.isBlank() ? "deviation" : sort;
        requireAllowed(key, DEVIATION_SORTS);
        Loaded loaded = load();
        List<DeviationRow> rows = new ArrayList<>();
        for (ChartAggregateRow row : loaded.rows()) {
            if (row.tier() == null) {
                continue;   // 미정은 편차를 낼 폴더가 없다(미정 목록에서 본다)
            }
            BigDecimal avg = ChartStatsCalculator.average(row.sumRate(), row.players());
            BigDecimal folderAvg = ChartStatsCalculator.folderAverage(row.songDifficultyId(), loaded.folder(row.tier()));
            BigDecimal deviation = ChartStatsCalculator.deviation(avg, folderAvg);
            int sample = folderAvg == null ? 0 : (int) loaded.folder(row.tier()).stream()
                    .filter(c -> !c.chartId().equals(row.songDifficultyId()) && c.avg() != null).count();
            rows.add(new DeviationRow(chart(row), row.players(), row.records(), ChartStatsCalculator.display(avg),
                    ChartStatsCalculator.display(folderAvg), ChartStatsCalculator.display(deviation), sample));
        }
        Comparator<DeviationRow> byPlayers = Comparator.comparingInt(DeviationRow::players).reversed()
                .thenComparing(r -> r.chart().songDifficultyId());
        Comparator<DeviationRow> order = switch (key) {
            case "avg" -> Comparator.comparing(DeviationRow::avgRate, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byPlayers);
            case "players" -> Comparator.comparingInt(DeviationRow::players).reversed()
                    .thenComparing(Comparator.comparingLong(DeviationRow::records).reversed())
                    .thenComparing(r -> r.chart().songDifficultyId());
            default -> Comparator.comparing((DeviationRow r) -> r.deviation() == null ? null : r.deviation().abs(),
                    Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byPlayers);
        };
        rows.sort(order);
        return page(rows, page, size, loaded.meta());
    }

    /**
     * 인기 목록. range=all은 저장 횟수 많은 순, 7d는 최근 7일에 저장된 횟수가 있는 채보만 그 증가분이 많은 순.
     * 기준 난이도가 없는(미정) 채보도 포함한다. 저장 횟수는 기록 건수, 플레이어 수는 사람 수다.
     */
    public Page<PopularityRow> popularity(Long actorId, String range, int page, int size) {
        requireAdmin(actorId);
        String key = range == null || range.isBlank() ? "all" : range;
        requireAllowed(key, POPULARITY_RANGES);
        Loaded loaded = load();
        List<PopularityRow> rows = loaded.rows().stream()
                .filter(r -> key.equals("all") || r.recentRecords() > 0)
                .map(r -> new PopularityRow(chart(r), r.records(), r.players(), r.recentRecords()))
                .sorted(key.equals("all")
                        ? Comparator.comparingLong(PopularityRow::records).reversed()
                                .thenComparing(Comparator.comparingInt(PopularityRow::players).reversed())
                                .thenComparing(r -> r.chart().songDifficultyId())
                        : Comparator.comparingLong(PopularityRow::recentRecords).reversed()
                                .thenComparing(Comparator.comparingLong(PopularityRow::records).reversed())
                                .thenComparing(r -> r.chart().songDifficultyId()))
                .toList();
        return page(rows, page, size, loaded.meta());
    }

    /** 폴더 곡선: 기준 난이도 오름차순. 표본 부족 폴더(평균 null)는 증감 계산에서 건너뛴다. */
    public Page<FolderRow> folders(Long actorId, int page, int size) {
        requireAdmin(actorId);
        Loaded loaded = load();
        Map<BigDecimal, Integer> counts = new TreeMap<>();
        if (loaded.tableId() != null) {
            for (FolderChartCountRow row : statsMapper.findFolderChartCounts(loaded.tableId())) {
                counts.put(row.tier().setScale(1, RoundingMode.HALF_UP), row.chartCount());
            }
        }
        List<ChartAvg> charts = loaded.avgs().stream().filter(c -> c.tier() != null).toList();
        List<FolderRow> rows = ChartStatsCalculator.folderCurve(counts, charts).stream()
                .map(f -> new FolderRow(f.tier(), f.chartCount(), f.sampledCharts(), ChartStatsCalculator.display(f.avg()),
                        ChartStatsCalculator.display(f.delta())))
                .toList();
        return page(rows, page, size, loaded.meta());
    }

    /** 미정 목록: 서열표 기준 난이도가 없는데 공개 유저 기록이 있는 채보. 저장 횟수 많은 순. */
    public Page<UndecidedRow> undecided(Long actorId, int page, int size) {
        requireAdmin(actorId);
        Loaded loaded = load();
        List<UndecidedRow> rows = loaded.rows().stream()
                .filter(r -> r.tier() == null)
                .map(r -> new UndecidedRow(chart(r), r.records(), r.players()))
                .sorted(Comparator.comparingLong(UndecidedRow::records).reversed()
                        .thenComparing(Comparator.comparingInt(UndecidedRow::players).reversed())
                        .thenComparing(r -> r.chart().songDifficultyId()))
                .toList();
        return page(rows, page, size, loaded.meta());
    }

    // ---- 채보 하나 -----------------------------------------------------------------------------------

    /** 채보 요약: 인원·기록 수·평균·중앙값·폴더 평균·편차. 곡 상세의 관리자 카드와 유저별 상세 화면이 같이 쓴다. 없거나 삭제된 채보는 404. */
    public Summary summary(Long actorId, Long songDifficultyId) {
        requireAdmin(actorId);
        Loaded loaded = load();
        ChartInfoRow info = statsMapper.findChartInfo(songDifficultyId, loaded.tableId());
        if (info == null) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        List<ChartPlayerRow> players = statsMapper.findPlayerRows(loaded.noteOption(), songDifficultyId, loaded.since());
        List<BigDecimal> rates = players.stream().map(ChartPlayerRow::bestRate).toList();
        BigDecimal sum = rates.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = ChartStatsCalculator.average(sum, players.size());
        BigDecimal median = ChartStatsCalculator.median(rates);
        BigDecimal folderAvg = null;
        int sample = 0;
        if (info.tier() != null) {
            List<ChartAvg> folder = loaded.folder(info.tier());
            folderAvg = ChartStatsCalculator.folderAverage(songDifficultyId, folder);
            sample = folderAvg == null ? 0 : (int) folder.stream().filter(c -> !c.chartId().equals(songDifficultyId) && c.avg() != null).count();
        }
        long records = players.stream().mapToLong(ChartPlayerRow::playCount).sum();
        return new Summary(chart(info), players.size(), records, ChartStatsCalculator.display(avg), ChartStatsCalculator.display(median),
                ChartStatsCalculator.display(folderAvg), ChartStatsCalculator.display(ChartStatsCalculator.deviation(avg, folderAvg)),
                sample, loaded.meta());
    }

    /**
     * 채보별 공개 유저 목록. 정렬: rate = 최고 달성률 높은 순(기본), score = 레이팅 총점 높은 순, plays = 이 곡 저장 횟수 많은 순. 같으면 user_id 순.
     * 총점·티어는 후보 쿼리 한 번(ratedBatch)으로 구한다: 총점 정렬이면 이 채보의 공개 유저 전원, 아니면 이번 페이지의 유저만.
     */
    public Page<PlayerRow> players(Long actorId, Long songDifficultyId, String sort, int page, int size) {
        requireAdmin(actorId);
        String key = sort == null || sort.isBlank() ? "rate" : sort;
        requireAllowed(key, PLAYER_SORTS);
        Loaded loaded = load();
        if (statsMapper.findChartInfo(songDifficultyId, loaded.tableId()) == null) {
            throw new ApiException(ErrorCode.NOT_FOUND);
        }
        List<ChartPlayerRow> all = new ArrayList<>(statsMapper.findPlayerRows(loaded.noteOption(), songDifficultyId, loaded.since()));
        int pageSize = pageSize(size);
        int pageIndex = Math.max(page, 0);
        Comparator<ChartPlayerRow> byUser = Comparator.comparing(ChartPlayerRow::userId);
        Map<Long, SkillService.RatedSkill> rated = new HashMap<>();
        if (key.equals("score")) {
            rated.putAll(skillService.ratedBatch(all.stream().map(ChartPlayerRow::userId).toList()));
            all.sort(Comparator.comparing((ChartPlayerRow r) -> totalOf(rated.get(r.userId()))).reversed().thenComparing(byUser));
        } else if (key.equals("plays")) {
            all.sort(Comparator.comparingLong(ChartPlayerRow::playCount).reversed().thenComparing(byUser));
        } else {
            all.sort(Comparator.comparing(ChartPlayerRow::bestRate).reversed().thenComparing(byUser));
        }
        int from = (int) Math.min((long) pageIndex * pageSize, all.size());
        List<ChartPlayerRow> pageRows = all.subList(from, Math.min(from + pageSize, all.size()));
        if (!key.equals("score")) {
            rated.putAll(skillService.ratedBatch(pageRows.stream().map(ChartPlayerRow::userId).toList()));
        }
        List<PlayerRow> content = pageRows.stream().map(r -> {
            SkillService.RatedSkill skill = rated.get(r.userId());
            PlayerTierResponse tier = skill == null || skill.skill() == null ? null : skill.skill().tier();
            return new PlayerRow(r.userId(), r.nickname(), tier, totalOf(skill), r.bestRate().setScale(2, RoundingMode.HALF_UP),
                    r.playCount(), r.lastPlayedAt() == null ? null : r.lastPlayedAt().toInstant(ZoneOffset.UTC));
        }).toList();
        int totalPages = (all.size() + pageSize - 1) / pageSize;
        return new Page<>(content, pageIndex, pageSize, all.size(), totalPages, loaded.meta());
    }

    // ---- 내부 ------------------------------------------------------------------------------------

    /** 한 요청 동안 쓰는 읽기 결과 묶음. 채보별 집계 + 폴더별 채보 평균 + 집계 기준. */
    private record Loaded(String noteOption, Long tableId, LocalDateTime since, List<ChartAggregateRow> rows, List<ChartAvg> avgs,
                          Map<BigDecimal, List<ChartAvg>> folders, Meta meta) {

        List<ChartAvg> folder(BigDecimal tier) {
            return folders.getOrDefault(tier.setScale(1, RoundingMode.HALF_UP), List.of());
        }
    }

    private Loaded load() {
        // 기록 옵션과 서열표는 레이팅과 같은 설정(SRN+, D25)을 쓴다. 한 곳에서만 정한다.
        NoteOption option = skillService.ratingConfig().noteOption();
        String noteOption = option.name();
        Long tableId = difficultyTableRepository.findFirstByNoteOptionAndStatusOrderByIdAsc(option, TableStatus.ACTIVE)
                .map(t -> t.getId()).orElse(null);
        LocalDateTime since = sinceUtc();
        List<ChartAggregateRow> rows = statsMapper.findChartAggregates(noteOption, tableId, since);
        List<ChartAvg> avgs = rows.stream()
                .map(r -> new ChartAvg(r.songDifficultyId(), r.tier(), ChartStatsCalculator.average(r.sumRate(), r.players())))
                .toList();
        Map<BigDecimal, List<ChartAvg>> folders = avgs.stream()
                .filter(c -> c.tier() != null)
                .collect(Collectors.groupingBy(c -> c.tier().setScale(1, RoundingMode.HALF_UP)));
        Meta meta = new Meta(statsMapper.countPublicUsers(), ChartStatsCalculator.MIN_PLAYERS, ChartStatsCalculator.MIN_FOLDER_CHARTS, RECENT_DAYS);
        return new Loaded(noteOption, tableId, since, rows, avgs, folders, meta);
    }

    /** 최근 7일의 시작: Asia/Seoul 달력으로 오늘 포함 7일 전(= 6일 전)의 0시를 UTC 시각으로 바꾼 값. created_at은 UTC로 저장돼 있다. */
    LocalDateTime sinceUtc() {
        LocalDate todaySeoul = LocalDate.now(clock.withZone(SEOUL));
        return todaySeoul.minusDays(RECENT_DAYS - 1L).atStartOfDay(SEOUL).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    /** DB의 현재 역할·상태로 ADMIN 이상인지 확인한다. 아니면 403. */
    private void requireAdmin(Long actorId) {
        User actor = actorId == null ? null : userRepository.findById(actorId).orElse(null);
        if (actor == null || !actor.isActive() || (actor.getRole() != Role.ADMIN && actor.getRole() != Role.ROOT)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
    }

    private static void requireAllowed(String value, Set<String> allowed) {
        if (!allowed.contains(value)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
    }

    private static int pageSize(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }

    private static <T> Page<T> page(List<T> sorted, int page, int size, Meta meta) {
        int pageSize = pageSize(size);
        int pageIndex = Math.max(page, 0);
        int from = (int) Math.min((long) pageIndex * pageSize, sorted.size());
        List<T> content = sorted.subList(from, Math.min(from + pageSize, sorted.size()));
        int totalPages = (sorted.size() + pageSize - 1) / pageSize;
        return new Page<>(List.copyOf(content), pageIndex, pageSize, sorted.size(), totalPages, meta);
    }

    private static BigDecimal totalOf(SkillService.RatedSkill rated) {
        return rated == null || rated.skill() == null ? BigDecimal.ZERO : rated.skill().totalScore();
    }

    private static Chart chart(ChartAggregateRow r) {
        return new Chart(r.songDifficultyId(), r.songId(), r.title(), InstrumentPart.valueOf(r.part()), DifficultyType.valueOf(r.difficulty()),
                r.level(), r.tier());
    }

    private static Chart chart(ChartInfoRow r) {
        return new Chart(r.songDifficultyId(), r.songId(), r.title(), InstrumentPart.valueOf(r.part()), DifficultyType.valueOf(r.difficulty()),
                r.level(), r.tier());
    }
}
