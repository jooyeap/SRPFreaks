package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.csv.CsvWriter;
import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.repository.DifficultyTableEntryRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 마스터 CSV 내려받기: 곡·채보 전체와 지정한 서열표의 값을 한 파일로 만든다.
 * 열 구성과 순서는 시드 CSV와 같아서, 내려받은 파일을 고쳐서 그대로 다시 올릴 수 있다(왕복).
 * 서열표에 올라가지 않은 채보도 값 칸만 비운 채 나온다(올리면 새 항목으로 추가된다).
 * 노트 수, 아티스트, BPM 같은 메타데이터 열은 넣지 않는다(곡 수정 API와 초기 등록 때 관리자가 입력한다).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MasterCsvExportService {

    static final List<String> HEADER = List.of("title", "part", "difficulty", "level", "added_version",
            "tier_label", "tier_uncertain", "recommend", "recommend_uncertain",
            "pattern_type", "pattern_uncertain", "source");

    private final SongDifficultyRepository songDifficultyRepository;
    private final DifficultyTableRepository difficultyTableRepository;
    private final DifficultyTableEntryRepository difficultyTableEntryRepository;

    public byte[] export(Long tableId) {
        difficultyTableRepository.findById(tableId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        Map<Long, DifficultyTableEntry> entries = new HashMap<>();
        for (DifficultyTableEntry e : difficultyTableEntryRepository.findAllByDifficultyTableId(tableId)) {
            entries.put(e.getSongDifficulty().getId(), e);
        }

        List<SongDifficulty> charts = songDifficultyRepository.findAllActiveWithSong().stream()
                .sorted(Comparator.comparing((SongDifficulty d) -> d.getSong().getTitle(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(SongDifficulty::getInstrumentPart)
                        .thenComparing(SongDifficulty::getDifficultyType))
                .toList();

        List<List<String>> rows = charts.stream().map(d -> row(d, entries.get(d.getId()))).toList();
        return CsvWriter.toBytes(HEADER, rows);
    }

    private static List<String> row(SongDifficulty d, DifficultyTableEntry e) {
        Song song = d.getSong();
        return List.of(
                song.getTitle(),
                d.getInstrumentPart().name(),
                d.getDifficultyType().name(),
                d.getLevel().toPlainString(),
                nullToEmpty(song.getAddedVersion()),
                e == null || e.getTierLabel() == null ? "" : e.getTierLabel().toPlainString(),
                e != null && e.isTierUncertain() ? "1" : "",
                e == null || e.getRecommend() == null ? "" : e.getRecommend().getLabel(),
                e != null && e.isRecommendUncertain() ? "1" : "",
                e == null || e.getPatternType() == null ? "" : e.getPatternType().getLabel(),
                e != null && e.isPatternUncertain() ? "1" : "",
                nullToEmpty(song.getSource()));
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
