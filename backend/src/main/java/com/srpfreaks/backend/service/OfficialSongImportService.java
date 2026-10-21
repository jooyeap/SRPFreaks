package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.OfficialSongCommitRequest;
import com.srpfreaks.backend.dto.OfficialSongCommitResponse;
import com.srpfreaks.backend.dto.OfficialSongImportRequest;
import com.srpfreaks.backend.dto.OfficialSongImportRequest.OfficialChartRow;
import com.srpfreaks.backend.dto.OfficialSongImportRequest.OfficialSong;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse.ArtistFill;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse.ArtistMismatch;
import com.srpfreaks.backend.dto.OfficialSongPreviewResponse.LevelChange;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 공식 곡 목록의 아티스트·레벨을 마스터와 비교하고 ROOT가 고른 것만 반영한다 (D42, 컨트롤러가 ROOT만 통과시킨다).
 *
 * 지켜야 할 선: ① 새 곡·새 채보를 만들지 않는다(자동 등록 금지) ② 아티스트가 이미 있는 곡은 덮어쓰지 않고 "다름"으로 표시만 한다
 * ③ 미리보기와 반영이 같은 계산(compute)을 쓰고, 반영은 고른 id가 지금도 차이일 때만 한다(요청 값을 믿지 않는다)
 * ④ 서버는 공식 사이트와 통신하지 않는다(값은 ROOT의 브라우저가 읽어 보낸다).
 */
@Service
@RequiredArgsConstructor
public class OfficialSongImportService {

    static final String AUDIT_ACTION = "SONG_OFFICIAL_IMPORT";
    private static final int MAX_UNMATCHED_TITLES = 50;
    private static final int MAX_AUDIT_IDS = 200;
    private static final BigDecimal MAX_LEVEL = new BigDecimal("9.99");
    private static final DifficultyType[] LEVEL_ORDER = {
            DifficultyType.BASIC, DifficultyType.ADVANCED, DifficultyType.EXTREME, DifficultyType.MASTER};

    private final SongRepository songRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public OfficialSongPreviewResponse preview(OfficialSongImportRequest request) {
        return compute(request.songs()).toResponse();
    }

    @Transactional
    public OfficialSongCommitResponse commit(Long actorId, OfficialSongCommitRequest request) {
        Diff diff = compute(request.songs());
        Set<Long> wantedSongs = new HashSet<>(request.artistSongIds());
        Set<Long> wantedCharts = new HashSet<>(request.levelChartIds());

        List<Long> filledSongIds = new ArrayList<>();
        for (PendingFill fill : diff.fills) {
            if (wantedSongs.contains(fill.song.getId())) {
                fill.song.changeArtist(fill.officialArtist);
                filledSongIds.add(fill.song.getId());
            }
        }
        List<Long> changedChartIds = new ArrayList<>();
        for (PendingLevel change : diff.levels) {
            if (wantedCharts.contains(change.chart.getId())) {
                change.chart.changeLevel(change.officialLevel);
                changedChartIds.add(change.chart.getId());
            }
        }

        int skipped = (wantedSongs.size() - filledSongIds.size()) + (wantedCharts.size() - changedChartIds.size());
        if (!filledSongIds.isEmpty() || !changedChartIds.isEmpty()) {
            // 감사 로그에는 개수와 id만 넣는다(곡명·아티스트 같은 값은 넣지 않는다)
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("artistFilled", filledSongIds.size());
            detail.put("levelChanged", changedChartIds.size());
            detail.put("songIds", filledSongIds.stream().limit(MAX_AUDIT_IDS).toList());
            detail.put("chartIds", changedChartIds.stream().limit(MAX_AUDIT_IDS).toList());
            auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), AUDIT_ACTION, "SONG", null, detail));
        }
        return new OfficialSongCommitResponse(filledSongIds.size(), changedChartIds.size(), skipped);
    }

    // ---------------------------------------------------------------- 비교 계산 (미리보기·반영 공통)

    private Diff compute(List<OfficialSong> officialSongs) {
        Map<String, OfficialMerged> merged = mergeByTitle(officialSongs);

        // 곡 본명과 표기·별칭(song_titles)을 정규화해서 곡 id로 찾는다 (삭제된 곡은 두 쿼리 모두에서 빠진다)
        Map<String, Set<Long>> songIdsByTitle = new HashMap<>();
        songRepository.findAllTitles().forEach(t -> add(songIdsByTitle, t.text(), t.songId()));
        songRepository.findAllAliasTitles().forEach(t -> add(songIdsByTitle, t.text(), t.songId()));

        Map<Long, Map<ChartKey, SongDifficulty>> chartsBySong = new HashMap<>();
        Map<Long, Song> songs = new HashMap<>();
        for (SongDifficulty d : songDifficultyRepository.findAllActiveWithSong()) {
            chartsBySong.computeIfAbsent(d.getSong().getId(), k -> new HashMap<>())
                    .put(new ChartKey(d.getInstrumentPart(), d.getDifficultyType()), d);
            songs.put(d.getSong().getId(), d.getSong());
        }
        // 채보가 하나도 없는 곡도 아티스트는 채울 수 있어서 곡을 따로 읽는다 (이미 읽은 곡은 그대로 쓴다)
        Set<Long> missing = new HashSet<>();
        for (Set<Long> ids : songIdsByTitle.values()) {
            ids.stream().filter(id -> !songs.containsKey(id)).forEach(missing::add);
        }
        if (!missing.isEmpty()) {
            songRepository.findAllById(missing).stream().filter(s -> !s.isDeleted()).forEach(s -> songs.put(s.getId(), s));
        }

        Diff diff = new Diff(merged.size());
        Set<Long> seenSongs = new HashSet<>();
        for (Map.Entry<String, OfficialMerged> entry : merged.entrySet()) {
            Set<Long> ids = songIdsByTitle.getOrDefault(entry.getKey(), Set.of());
            // 같은 이름의 곡이 둘 이상이면 어느 곡인지 알 수 없어서 제외한다 (D34와 같은 규칙)
            if (ids.size() != 1) {
                diff.unmatched.add(entry.getValue().title);
                continue;
            }
            Long songId = ids.iterator().next();
            Song song = songs.get(songId);
            if (song == null || !seenSongs.add(songId)) {
                // 삭제된 곡이거나, 다른 공식 줄이 이미 같은 곡에 맞았다(표기가 달라 두 줄이 한 곡을 가리키는 경우)
                diff.unmatched.add(entry.getValue().title);
                continue;
            }
            diff.matched++;
            boolean changed = compareArtist(diff, song, entry.getValue());
            changed |= compareLevels(diff, song, entry.getValue(), chartsBySong.getOrDefault(songId, Map.of()));
            if (!changed) {
                diff.unchanged++;
            }
        }
        return diff;
    }

    /** 아티스트 비교. 비어 있으면 채울 후보, 이미 있고 다르면 표시만 한다. 바뀔 것이 있으면 true. */
    private boolean compareArtist(Diff diff, Song song, OfficialMerged official) {
        if (official.artist == null) {
            return false;
        }
        if (song.getArtist() == null || song.getArtist().isBlank()) {
            diff.fills.add(new PendingFill(song, official.artist));
            return true;
        }
        if (!SongTitle.normalize(song.getArtist()).equals(SongTitle.normalize(official.artist))) {
            diff.mismatches.add(new ArtistMismatch(song.getId(), song.getTitle(), song.getArtist(), official.artist));
        }
        return false;
    }

    /** 이미 있는 채보의 레벨 비교. 없는 채보는 만들지 않는다. 바뀔 것이 있으면 true. */
    private boolean compareLevels(Diff diff, Song song, OfficialMerged official, Map<ChartKey, SongDifficulty> charts) {
        boolean changed = false;
        for (Map.Entry<ChartKey, BigDecimal> e : official.levels.entrySet()) {
            SongDifficulty chart = charts.get(e.getKey());
            if (chart != null && chart.getLevel().compareTo(e.getValue()) != 0) {
                diff.levels.add(new PendingLevel(song, chart, e.getValue()));
                changed = true;
            }
        }
        return changed;
    }

    /** 같은 곡명(정규화)의 줄을 한 곡으로 합친다. 같은 채보가 겹치면 먼저 온 값을 쓴다. */
    private Map<String, OfficialMerged> mergeByTitle(List<OfficialSong> officialSongs) {
        Map<String, OfficialMerged> merged = new LinkedHashMap<>();
        for (OfficialSong s : officialSongs) {
            OfficialMerged m = merged.computeIfAbsent(SongTitle.normalize(s.title()), k -> new OfficialMerged(s.title().strip()));
            if (m.artist == null) {
                m.artist = blankToNull(s.artist());
            }
            for (OfficialChartRow row : s.charts()) {
                InstrumentPart part = partOf(row.part());
                if (part == null) {
                    continue;
                }
                for (int i = 0; i < LEVEL_ORDER.length && i < row.levels().size(); i++) {
                    BigDecimal level = parseLevel(row.levels().get(i));
                    if (level != null) {
                        m.levels.putIfAbsent(new ChartKey(part, LEVEL_ORDER[i]), level);
                    }
                }
            }
        }
        return merged;
    }

    static InstrumentPart partOf(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.strip().toUpperCase(java.util.Locale.ROOT)) {
            case "G" -> InstrumentPart.GUITAR;
            case "B" -> InstrumentPart.BASS;
            default -> null;
        };
    }

    /** 레벨 글자를 숫자로. 비었거나 "-"이거나 0.00~9.99 소수 둘째 자리 밖이면 null(비교에서 뺀다). */
    static BigDecimal parseLevel(String text) {
        if (text == null) {
            return null;
        }
        String t = text.strip();
        if (t.isEmpty() || t.equals("-")) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(t);
            if (value.signum() < 0 || value.compareTo(MAX_LEVEL) > 0 || value.stripTrailingZeros().scale() > 2) {
                return null;
            }
            return value.setScale(2, java.math.RoundingMode.UNNECESSARY);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void add(Map<String, Set<Long>> index, String title, Long songId) {
        index.computeIfAbsent(SongTitle.normalize(title), k -> new HashSet<>()).add(songId);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    // ---------------------------------------------------------------- 내부 값

    private record ChartKey(InstrumentPart part, DifficultyType type) {
    }

    private static final class OfficialMerged {
        final String title;
        String artist;
        final Map<ChartKey, BigDecimal> levels = new HashMap<>();

        OfficialMerged(String title) {
            this.title = title;
        }
    }

    private record PendingFill(Song song, String officialArtist) {
    }

    private record PendingLevel(Song song, SongDifficulty chart, BigDecimal officialLevel) {
    }

    private static final class Diff {
        final int readSongs;
        int matched;
        int unchanged;
        final List<String> unmatched = new ArrayList<>();
        final List<PendingFill> fills = new ArrayList<>();
        final List<ArtistMismatch> mismatches = new ArrayList<>();
        final List<PendingLevel> levels = new ArrayList<>();

        Diff(int readSongs) {
            this.readSongs = readSongs;
        }

        OfficialSongPreviewResponse toResponse() {
            return new OfficialSongPreviewResponse(
                    readSongs, matched, unchanged, unmatched.size(),
                    unmatched.stream().limit(MAX_UNMATCHED_TITLES).toList(),
                    fills.stream().map(f -> new ArtistFill(f.song.getId(), f.song.getTitle(), f.officialArtist)).toList(),
                    List.copyOf(mismatches),
                    levels.stream().map(l -> new LevelChange(l.chart.getId(), l.song.getId(), l.song.getTitle(),
                            l.chart.getInstrumentPart().name(), l.chart.getDifficultyType().name(),
                            l.chart.getLevel(), l.officialLevel)).toList());
        }
    }
}
