package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongImportResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.SongCsvParser.ImportRow;
import com.srpfreaks.backend.service.SongCsvParser.ParseResult;
import com.srpfreaks.backend.service.SongCsvParser.TableValues;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 마스터 CSV 일괄 등록: 미리보기 → 저장. 두 가지 모드가 있다.
 *  - importCsv: 곡·채보만 반영한다(서열표 열은 무시).
 *  - importTable: 곡·채보에 더해 지정한 서열표의 값(기준 난이도, 추천도, 속성)까지 반영한다.
 *    사이트에서 내려받은 CSV(MasterCsvExportService)를 고쳐 다시 올리는 용도이고, 파일이 그 표의 전체 내용이다.
 *    (파일에 없는 행은 건드리지도 지우지도 않는다. 삭제는 곡/채보 관리 API로 한다)
 *
 * 미리보기(confirm=false)는 계산만 하고 DB에 쓰지 않는다. 저장(confirm=true)은 파일을 다시 읽어 같은 계산을 한 뒤 반영한다.
 * 서버가 미리보기 상태를 들고 있지 않아서(세션/임시 저장 없음) 단순하고, 저장 시점의 마스터를 기준으로 다시 계산된다.
 * 주의: 미리보기 경로에서는 영속 상태의 엔티티를 절대 바꾸지 않는다(트랜잭션이 끝날 때 변경이 자동 저장되기 때문이다).
 *
 * 멱등 업서트: 키는 (정규화된 곡명, 파트, 난이도). 같은 파일을 여러 번 올려도 결과가 같다.
 * 오류 행이 하나라도 있으면 저장하지 않는다(일부만 들어가서 어디까지 반영됐는지 모르는 상태를 막는다).
 */
@Service
@RequiredArgsConstructor
public class SongImportService {

    static final int MAX_LISTED = 100;

    private final SongRepository songRepository;
    private final SongTitleRepository songTitleRepository;
    private final SongDifficultyRepository songDifficultyRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository difficultyTableEntryRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /** 곡 하나에 속한 CSV 행들과, 마스터에서 찾은 곡(없으면 null = 새 곡). */
    private record SongGroup(String normalizedTitle, List<ImportRow> rows, Song existing) {
    }

    /** 곡·채보만 반영한다. */
    @Transactional
    public SongImportResponse importCsv(Long actorId, byte[] content, boolean confirm) {
        return run(actorId, null, content, confirm);
    }

    /** 곡·채보와 서열표 값까지 반영한다. */
    @Transactional
    public SongImportResponse importTable(Long actorId, Long tableId, byte[] content, boolean confirm) {
        DifficultyTable table = difficultyTableRepository.findById(tableId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        return run(actorId, table, content, confirm);
    }

    private SongImportResponse run(Long actorId, DifficultyTable table, byte[] content, boolean confirm) {
        ParseResult parsed = SongCsvParser.parse(content, table != null);
        List<SongImportResponse.RowError> errors = parsed.errors().stream()
                .map(e -> new SongImportResponse.RowError(e.line(), e.message()))
                .collect(Collectors.toCollection(ArrayList::new));

        Map<String, List<ImportRow>> byTitle = new LinkedHashMap<>();
        Set<String> seenCharts = new HashSet<>();
        for (ImportRow row : parsed.rows()) {
            // 파일 안에서 같은 채보가 두 번 나오면 어느 쪽 값이 맞는지 알 수 없으므로 오류로 돌려준다
            if (!seenCharts.add(row.normalizedTitle() + "|" + row.part() + "|" + row.type())) {
                errors.add(new SongImportResponse.RowError(row.line(), "파일 안에 같은 채보가 중복되어 있습니다."));
                continue;
            }
            byTitle.computeIfAbsent(row.normalizedTitle(), k -> new ArrayList<>()).add(row);
        }

        // 곡 매칭용 색인. 곡이 수천 개 수준이라 전부 읽어 메모리에서 비교한다(정규화는 DB가 아니라 코드에서 한다).
        Map<Long, Song> songsById = new HashMap<>();
        Map<String, Set<Long>> index = buildIndex(songsById);

        List<SongGroup> groups = new ArrayList<>();
        int skippedDeleted = 0;
        for (Map.Entry<String, List<ImportRow>> entry : byTitle.entrySet()) {
            List<ImportRow> rows = entry.getValue();
            Set<Long> candidates = index.getOrDefault(entry.getKey(), Set.of());
            if (candidates.size() > 1) {
                rows.forEach(r -> errors.add(new SongImportResponse.RowError(r.line(),
                        "같은 이름으로 찾아지는 곡이 둘 이상입니다. 곡을 직접 확인해 주세요.")));
                continue;
            }
            Set<String> versions = rows.stream().map(ImportRow::addedVersion).filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (versions.size() > 1) {
                rows.forEach(r -> errors.add(new SongImportResponse.RowError(r.line(),
                        "같은 곡의 초출 버전이 행마다 다릅니다.")));
                continue;
            }
            Song existing = candidates.isEmpty() ? null : songsById.get(candidates.iterator().next());
            if (existing != null && existing.isDeleted()) {
                // 삭제된 곡을 파일이 몰래 되살리지 않는다. 건너뛰고 개수만 알려 준다.
                skippedDeleted += rows.size();
                continue;
            }
            groups.add(new SongGroup(entry.getKey(), rows, existing));
        }

        // 기존 곡들의 채보를 한 번에 읽는다
        List<Long> existingIds = groups.stream().filter(g -> g.existing() != null)
                .map(g -> g.existing().getId()).toList();
        Map<String, SongDifficulty> existingCharts = new HashMap<>();
        if (!existingIds.isEmpty()) {
            for (SongDifficulty d : songDifficultyRepository.findBySongIdIn(existingIds)) {
                existingCharts.put(chartKey(d.getSong().getId(), d.getInstrumentPart(), d.getDifficultyType()), d);
            }
        }
        // 서열표 모드: 이 표의 기존 항목(채보 ID → 항목)
        Map<Long, DifficultyTableEntry> entriesByChart = new HashMap<>();
        if (table != null) {
            for (DifficultyTableEntry e : difficultyTableEntryRepository.findAllByDifficultyTableId(table.getId())) {
                entriesByChart.put(e.getSongDifficulty().getId(), e);
            }
        }

        boolean apply = confirm && errors.isEmpty();
        int newSongs = 0;
        int updatedSongs = 0;
        int newDifficulties = 0;
        int unchanged = 0;
        int newEntries = 0;
        int updatedEntries = 0;
        int unchangedEntries = 0;
        int levelChangeCount = 0;
        List<SongImportResponse.LevelChange> levelChanges = new ArrayList<>();

        for (SongGroup group : groups) {
            ImportRow first = group.rows().get(0);
            String version = group.rows().stream().map(ImportRow::addedVersion).filter(Objects::nonNull)
                    .findFirst().orElse(null);
            Song song = group.existing();

            if (song == null) {
                newSongs++;
                if (apply) {
                    String source = group.rows().stream().map(ImportRow::source).filter(Objects::nonNull)
                            .findFirst().orElse(null);
                    song = Song.create(first.title(), null, source, userRepository.getReferenceById(actorId));
                    song.changeMeta(version, null, null, null);
                    songRepository.save(song);
                }
            } else if (version != null && !version.equals(song.getAddedVersion())) {
                updatedSongs++;
                if (apply) {
                    // 비어 있는 CSV 값으로 기존 메타데이터(BPM 등)를 지우지 않도록 나머지는 그대로 넘긴다
                    song.changeMeta(version, song.getTitleFolder(), song.getBpmMin(), song.getBpmMax());
                }
            }

            for (ImportRow row : group.rows()) {
                SongDifficulty chart = song == null || song.getId() == null ? null
                        : existingCharts.get(chartKey(song.getId(), row.part(), row.type()));
                if (chart != null && chart.isDeleted()) {
                    skippedDeleted++;
                    continue;   // 삭제된 채보는 서열표 값도 건드리지 않는다
                }
                if (chart == null) {
                    newDifficulties++;
                    if (apply) {
                        SongDifficulty created = SongDifficulty.create(song, row.part(), row.type(), row.level());
                        songDifficultyRepository.save(created);
                        chart = created;
                    }
                } else if (chart.getLevel().compareTo(row.level()) == 0) {
                    unchanged++;
                } else {
                    levelChangeCount++;
                    if (levelChanges.size() < MAX_LISTED) {
                        levelChanges.add(new SongImportResponse.LevelChange(song.getTitle(), row.part(), row.type(),
                                chart.getLevel(), row.level()));
                    }
                    if (apply) {
                        chart.changeLevel(row.level());
                    }
                }

                if (table != null) {
                    TableValues v = row.tableValues();
                    DifficultyTableEntry entry = chart == null || chart.getId() == null ? null
                            : entriesByChart.get(chart.getId());
                    if (entry == null) {
                        newEntries++;
                        if (apply) {
                            entry = DifficultyTableEntry.create(table, chart);
                            applyValues(entry, v);
                            difficultyTableEntryRepository.save(entry);
                        }
                    } else if (entry.hasValues(v.tier(), v.tierUncertain(), v.recommend(), v.recommendUncertain(),
                            v.pattern(), v.patternUncertain())) {
                        unchangedEntries++;
                    } else {
                        updatedEntries++;
                        if (apply) {
                            applyValues(entry, v);
                        }
                    }
                }
            }
        }

        if (apply) {
            if (table != null && newEntries + updatedEntries > 0) {
                table.bumpRevision();   // 표 내용이 바뀌었음을 표시(변경 추적용)
            }
            try {
                // 동시에 다른 관리자가 같은 곡/채보를 등록하면 유니크 키 위반이 나므로 여기서 바로 반영해 409로 바꾼다
                songDifficultyRepository.flush();
            } catch (DataIntegrityViolationException e) {
                throw new ApiException(ErrorCode.CONFLICT);
            }
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("rows", parsed.totalRows());
            detail.put("newSongs", newSongs);
            detail.put("updatedSongs", updatedSongs);
            detail.put("newDifficulties", newDifficulties);
            detail.put("levelChanges", levelChangeCount);
            if (table != null) {
                detail.put("newEntries", newEntries);
                detail.put("updatedEntries", updatedEntries);
            }
            auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId),
                    table == null ? "SONG_IMPORT" : "DIFFICULTY_TABLE_IMPORT",
                    table == null ? "SONG" : "DIFFICULTY_TABLE",
                    table == null ? null : String.valueOf(table.getId()), detail));
        }

        List<SongImportResponse.RowError> listedErrors = errors.size() > MAX_LISTED
                ? errors.subList(0, MAX_LISTED) : errors;
        return new SongImportResponse(apply, parsed.totalRows(), newSongs, updatedSongs, newDifficulties, unchanged,
                skippedDeleted, newEntries, updatedEntries, unchangedEntries, levelChangeCount, levelChanges,
                errors.size(), listedErrors);
    }

    /** CSV 값을 항목에 반영한다. tier_order(표 안 정렬 순서)는 CSV에 없으므로 기존 값을 유지한다. */
    private static void applyValues(DifficultyTableEntry entry, TableValues v) {
        entry.changeTier(v.tier(), v.tierUncertain(), entry.getTierOrder());
        entry.changeRecommend(v.recommend(), v.recommendUncertain());
        entry.changePattern(v.pattern(), v.patternUncertain());
    }

    /**
     * 정규화한 곡명 → 곡 ID들. 곡 본명과 곡명 표기/별칭(song_titles)을 모두 넣는다.
     * 같은 곡이 본명과 별칭으로 두 번 걸려도 ID 집합이라 한 곡으로 센다.
     */
    private Map<String, Set<Long>> buildIndex(Map<Long, Song> songsById) {
        Map<String, Set<Long>> index = new HashMap<>();
        for (Song song : songRepository.findAll()) {
            songsById.put(song.getId(), song);
            index.computeIfAbsent(SongTitle.normalize(song.getTitle()), k -> new HashSet<>()).add(song.getId());
        }
        for (SongTitle title : songTitleRepository.findAll()) {
            index.computeIfAbsent(title.getNormalizedTitle(), k -> new HashSet<>()).add(title.getSong().getId());
        }
        return index;
    }

    private static String chartKey(Long songId, InstrumentPart part, DifficultyType type) {
        return songId + "|" + part + "|" + type;
    }
}
