package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongInfoCommitRequest;
import com.srpfreaks.backend.dto.SongInfoCommitRequest.Selection;
import com.srpfreaks.backend.dto.SongInfoCommitResponse;
import com.srpfreaks.backend.dto.SongInfoImportRequest;
import com.srpfreaks.backend.dto.SongInfoImportRequest.InfoRow;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.ArtistChange;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.BpmChange;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.Row;
import com.srpfreaks.backend.dto.SongInfoPreviewResponse.Status;
import com.srpfreaks.backend.dto.SongJacketMatchResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 공식 `곡별 성적` 화면에서 읽은 아티스트(D90)와 RemyWiki 곡 표에서 읽은 BPM(D93)을 마스터와 비교하고 ROOT가 고른 것만 반영한다 (컨트롤러가 ROOT만 통과시킨다).
 * RemyWiki 경로는 artist를 빈 글자로 보내고 항목은 bpm만 고르므로 이 서비스는 그대로 쓴다(서버는 어느 쪽 사이트와도 통신하지 않는다).
 * 작곡가 컬럼은 따로 없다: 게임 표기 `songs.artist`가 그 자리이고(D13), BPM은 `songs.bpm_min/bpm_max`(고정 BPM이면 같은 값)다.
 *
 * 지켜야 할 선: ① 새 곡을 만들지 않는다(마스터와 곡명이 맞은 곡만, 자동 등록 금지)
 * ② 미리보기와 저장이 같은 계산(evaluate)을 쓰고, 저장은 고른 항목이 지금도 바뀔 것이 있을 때만 한다(요청 값을 믿지 않는다)
 * ③ 서버는 공식 사이트와 통신하지 않는다 ④ 감사 로그에는 개수와 곡 id만 남긴다(아티스트·BPM 값은 넣지 않는다).
 * 곡명 매칭은 재킷 가져오기(D54)와 같은 규칙이라 {@link SongJacketAdminService#match}를 그대로 쓴다.
 */
@Service
@RequiredArgsConstructor
public class SongInfoImportService {

    static final String AUDIT_ACTION = "SONG_INFO_IMPORT";
    static final int MAX_ARTIST_LENGTH = 255;
    static final int MIN_BPM = 1;
    static final int MAX_BPM = 2000;
    private static final int MAX_AUDIT_IDS = 200;
    /** 고정 `172`, 가변 `120-180` (하이픈·물결표·긴 줄표). NFKC 정규화 뒤에 비교하므로 전각 숫자·물결표도 맞는다. */
    private static final Pattern BPM_PATTERN = Pattern.compile("^(\\d{1,4})(?:\\s*[-~\\u2013\\u2014\\u301C]\\s*(\\d{1,4}))?$");

    private final SongJacketAdminService jacketService;
    private final SongRepository songRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public SongInfoPreviewResponse preview(SongInfoImportRequest request) {
        List<Evaluated> evaluated = evaluate(request.songs());
        int unmatched = unmatchedCount(request.songs(), evaluated);
        List<Row> rows = evaluated.stream().map(Evaluated::toRow).toList();
        return new SongInfoPreviewResponse(distinctTitles(request.songs()), rows.size(), unmatched, rows);
    }

    @Transactional
    public SongInfoCommitResponse commit(Long actorId, SongInfoCommitRequest request) {
        Map<Long, Evaluated> bySong = new HashMap<>();
        evaluate(request.songs()).forEach(e -> bySong.putIfAbsent(e.song.getId(), e));

        // 같은 곡이 여러 번 와도 한 곡으로 본다(항목은 합친다)
        Map<Long, boolean[]> wanted = new LinkedHashMap<>();
        for (Selection s : request.selections()) {
            boolean[] flags = wanted.computeIfAbsent(s.songId(), k -> new boolean[2]);
            flags[0] |= s.artist();
            flags[1] |= s.bpm();
        }

        int artistFilled = 0;
        int artistOverwritten = 0;
        int bpmFilled = 0;
        int bpmOverwritten = 0;
        int skipped = 0;
        List<Long> touched = new ArrayList<>();
        for (Map.Entry<Long, boolean[]> entry : wanted.entrySet()) {
            Evaluated e = bySong.get(entry.getKey());
            boolean changed = false;
            if (entry.getValue()[0]) {
                if (e != null && isWritable(e.artistStatus)) {
                    e.song.changeArtist(e.officialArtist);
                    if (e.artistStatus == Status.FILL) artistFilled++;
                    else artistOverwritten++;
                    changed = true;
                } else {
                    skipped++;
                }
            }
            if (entry.getValue()[1]) {
                if (e != null && isWritable(e.bpmStatus)) {
                    e.song.changeBpm(e.officialBpm[0], e.officialBpm[1]);
                    if (e.bpmStatus == Status.FILL) bpmFilled++;
                    else bpmOverwritten++;
                    changed = true;
                } else {
                    skipped++;
                }
            }
            if (changed) {
                touched.add(entry.getKey());
            }
        }

        if (!touched.isEmpty()) {
            // 감사 로그에는 개수와 곡 id만 넣는다(값은 넣지 않는다)
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("artistFilled", artistFilled);
            detail.put("artistOverwritten", artistOverwritten);
            detail.put("bpmFilled", bpmFilled);
            detail.put("bpmOverwritten", bpmOverwritten);
            detail.put("songIds", touched.stream().limit(MAX_AUDIT_IDS).toList());
            auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), AUDIT_ACTION, "SONG", null, detail));
        }
        return new SongInfoCommitResponse(artistFilled, artistOverwritten, bpmFilled, bpmOverwritten, skipped);
    }

    // ---------------------------------------------------------------- 비교 계산 (미리보기·저장 공통)

    private List<Evaluated> evaluate(List<InfoRow> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        // 같은 곡명이 여러 줄이면 먼저 온 값을 쓴다. 매칭 결과의 officialTitle은 앞뒤 공백을 뗀 처음 글자라 같은 키로 찾는다
        Map<String, InfoRow> infoByTitle = new LinkedHashMap<>();
        for (InfoRow row : rows) {
            infoByTitle.putIfAbsent(row.title().strip(), row);
        }
        SongJacketMatchResponse match = jacketService.match(new ArrayList<>(infoByTitle.keySet()));
        Map<Long, Song> songs = new HashMap<>();
        songRepository.findAllById(match.matches().stream().map(SongJacketMatchResponse.Match::songId).toList())
                .stream().filter(s -> !s.isDeleted()).forEach(s -> songs.put(s.getId(), s));

        List<Evaluated> out = new ArrayList<>();
        for (SongJacketMatchResponse.Match m : match.matches()) {
            InfoRow info = infoByTitle.get(m.officialTitle());
            Song song = songs.get(m.songId());
            if (info == null || song == null) {
                continue;
            }
            out.add(new Evaluated(song, m.officialTitle(), normalizeArtist(info.artist()), parseBpm(info.bpm())));
        }
        return out;
    }

    private static int distinctTitles(List<InfoRow> rows) {
        return (int) rows.stream().map(r -> SongTitle.normalize(r.title())).distinct().count();
    }

    private static int unmatchedCount(List<InfoRow> rows, List<Evaluated> matched) {
        return Math.max(0, distinctTitles(rows) - matched.size());
    }

    private static boolean isWritable(Status status) {
        return status == Status.FILL || status == Status.OVERWRITE;
    }

    /**
     * 아티스트 글자를 저장 형태로. NFKC 정규화, 줄바꿈·제어문자는 공백으로 바꾸고 공백은 하나로 합친다.
     * 비었거나 255자를 넘으면 null(값 없음으로 취급, 잘라서 저장하지 않는다).
     */
    static String normalizeArtist(String raw) {
        if (raw == null) {
            return null;
        }
        String text = Normalizer.normalize(raw, Normalizer.Form.NFKC)
                .replaceAll("[\\p{Cntrl}\\r\\n]+", " ")
                .replaceAll("\\s+", " ")
                .strip();
        if (text.isEmpty() || text.length() > MAX_ARTIST_LENGTH) {
            return null;
        }
        return text;
    }

    /**
     * BPM 글자를 {최소, 최대}로. 고정 `172` → {172, 172}, 가변 `120-180` → {120, 180}.
     * 정수 1~2000이 아니거나 최소가 최대보다 크거나 읽을 수 없으면 null(값 없음). 공식 화면에 BPM이 없으면 비어서 null이다.
     */
    static int[] parseBpm(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = BPM_PATTERN.matcher(Normalizer.normalize(raw, Normalizer.Form.NFKC).strip());
        if (!m.matches()) {
            return null;
        }
        int min = Integer.parseInt(m.group(1));
        int max = m.group(2) == null ? min : Integer.parseInt(m.group(2));
        if (min < MIN_BPM || max > MAX_BPM || min > max) {
            return null;
        }
        return new int[]{min, max};
    }

    private static final class Evaluated {
        final Song song;
        final String officialTitle;
        final String officialArtist;
        final int[] officialBpm;
        final Status artistStatus;
        final Status bpmStatus;

        Evaluated(Song song, String officialTitle, String officialArtist, int[] officialBpm) {
            this.song = song;
            this.officialTitle = officialTitle;
            this.officialArtist = officialArtist;
            this.officialBpm = officialBpm;
            this.artistStatus = artistStatus(song, officialArtist);
            this.bpmStatus = bpmStatus(song, officialBpm);
        }

        private static Status artistStatus(Song song, String official) {
            if (official == null) {
                return Status.NONE;
            }
            String current = song.getArtist();
            if (current == null || current.isBlank()) {
                return Status.FILL;
            }
            // 대소문자·공백만 다른 표기는 같은 것으로 본다(곡명 비교와 같은 정규화)
            return SongTitle.normalize(current).equals(SongTitle.normalize(official)) ? Status.UNCHANGED : Status.OVERWRITE;
        }

        private static Status bpmStatus(Song song, int[] official) {
            if (official == null) {
                return Status.NONE;
            }
            if (song.getBpmMin() == null && song.getBpmMax() == null) {
                return Status.FILL;
            }
            return Objects.equals(song.getBpmMin(), official[0]) && Objects.equals(song.getBpmMax(), official[1])
                    ? Status.UNCHANGED : Status.OVERWRITE;
        }

        Row toRow() {
            return new Row(officialTitle, song.getId(), song.getTitle(),
                    new ArtistChange(song.getArtist(), officialArtist, artistStatus),
                    new BpmChange(song.getBpmMin(), song.getBpmMax(),
                            officialBpm == null ? null : officialBpm[0], officialBpm == null ? null : officialBpm[1], bpmStatus));
        }
    }
}
