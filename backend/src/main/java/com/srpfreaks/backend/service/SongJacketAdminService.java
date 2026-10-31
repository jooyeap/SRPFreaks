package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongJacketMatchResponse;
import com.srpfreaks.backend.dto.SongJacketMatchResponse.Match;
import com.srpfreaks.backend.dto.SongJacketMatchResponse.MissingSong;
import com.srpfreaks.backend.dto.SongJacketSaveResponse;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.SongRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.jacket.JacketStorage;
import com.srpfreaks.backend.service.jacket.WebpImage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 재킷 이미지 가져오기(D54). 컨트롤러가 권한을 건다(매칭·저장은 ROOT, 삭제는 ROOT·ADMIN).
 *
 * 지켜야 할 선: ① 서버는 공식 사이트와 통신하지 않는다(이미지는 ROOT의 브라우저가 읽고 줄여서 보낸다)
 * ② 곡을 새로 만들지 않는다(마스터에 있는 곡에만 붙인다) ③ 이미지는 다시 인코딩하지 않고 형식·크기만 확인한다
 * ④ 감사 로그에는 개수와 곡 id만 남긴다(이미지 값은 넣지 않는다).
 */
@Service
@RequiredArgsConstructor
public class SongJacketAdminService {

    static final String AUDIT_IMPORT = "SONG_JACKET_IMPORT";
    static final String AUDIT_DELETE = "SONG_JACKET_DELETE";
    /** 한 요청에 받는 장 수. 1장 50KB × 10 = 500KB로 nginx·multipart 한도(1MB) 안에 든다. */
    public static final int MAX_PER_REQUEST = 10;
    static final int MAX_BYTES = 50 * 1024;
    static final int MAX_SIDE = 256;

    private final SongRepository songRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final JacketStorage storage;

    /**
     * 공식 곡명을 마스터 곡과 맞춘다. 규칙은 D42와 같다: 곡 본명과 표기·별칭을 정규화해서 비교하고,
     * 같은 이름이 마스터에 둘 이상이면 어느 곡인지 몰라 뺀다. 한 곡에 공식 줄이 둘 맞으면 처음 것만 쓴다.
     */
    @Transactional(readOnly = true)
    public SongJacketMatchResponse match(List<String> officialTitles) {
        Map<String, Set<Long>> songIdsByTitle = new HashMap<>();
        songRepository.findAllTitles().forEach(t -> add(songIdsByTitle, t.text(), t.songId()));
        songRepository.findAllAliasTitles().forEach(t -> add(songIdsByTitle, t.text(), t.songId()));

        Map<Long, String> matchedTitle = new LinkedHashMap<>();
        int unmatched = 0;
        Set<String> seenTitles = new HashSet<>();
        for (String raw : officialTitles) {
            String key = SongTitle.normalize(raw);
            if (!seenTitles.add(key)) {
                continue; // 같은 곡명이 여러 번 와도 한 번만 센다
            }
            Set<Long> ids = songIdsByTitle.getOrDefault(key, Set.of());
            if (ids.size() != 1 || matchedTitle.containsKey(ids.iterator().next())) {
                unmatched++;
                continue;
            }
            matchedTitle.put(ids.iterator().next(), raw.strip());
        }

        List<Match> matches = new ArrayList<>();
        List<MissingSong> missing = new ArrayList<>();
        List<Song> songs = songRepository.findAll().stream()
                .filter(s -> !s.isDeleted())
                .sorted(Comparator.comparing(Song::getId))
                .toList();
        for (Song song : songs) {
            String official = matchedTitle.get(song.getId());
            if (official != null) {
                matches.add(new Match(official, song.getId(), song.getTitle(), song.getImageUrl() != null));
            } else {
                missing.add(new MissingSong(song.getId(), song.getTitle()));
            }
        }
        return new SongJacketMatchResponse(matches, unmatched, missing);
    }

    /** 곡 id와 이미지를 같은 순서로 받아 저장한다. 하나라도 형식이 틀리면 아무것도 저장하지 않는다. */
    @Transactional
    public SongJacketSaveResponse save(Long actorId, List<Long> songIds, List<byte[]> images) {
        if (songIds == null || images == null || songIds.isEmpty() || songIds.size() != images.size()
                || songIds.size() > MAX_PER_REQUEST || new HashSet<>(songIds).size() != songIds.size()) {
            throw new ApiException(ErrorCode.JACKET_BAD_IMAGE);
        }
        for (byte[] image : images) {
            if (!isAcceptable(image)) {
                throw new ApiException(ErrorCode.JACKET_BAD_IMAGE);
            }
        }
        List<Song> songs = new ArrayList<>();
        for (Long songId : songIds) {
            songs.add(songRepository.findByIdAndDeletedFalse(songId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND)));
        }

        int replaced = 0;
        for (int i = 0; i < songs.size(); i++) {
            Song song = songs.get(i);
            byte[] image = images.get(i);
            if (song.getImageUrl() != null) {
                replaced++;
            }
            storage.save(song.getId(), image);
            // 내용이 바뀌면 주소도 바뀌게(?v=해시) 해서, 브라우저·nginx 캐시에 옛 그림이 남지 않게 한다
            song.changeImageUrl("/jackets/" + song.getId() + ".webp?v=" + shortHash(image));
        }
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("count", songs.size());
        detail.put("replaced", replaced);
        detail.put("songIds", songIds);
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), AUDIT_IMPORT, "SONG", null, detail));
        return new SongJacketSaveResponse(songs.size() - replaced, replaced);
    }

    /** 재킷을 내린다(삭제 요청 대응, D21). 재킷이 없으면 아무것도 하지 않는다. */
    @Transactional
    public void delete(Long actorId, Long songId) {
        Song song = songRepository.findByIdAndDeletedFalse(songId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        storage.delete(song.getId());
        if (song.getImageUrl() == null) {
            return;
        }
        song.changeImageUrl(null);
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId), AUDIT_DELETE, "SONG",
                String.valueOf(song.getId()), Map.of()));
    }

    static boolean isAcceptable(byte[] image) {
        if (image == null || image.length > MAX_BYTES) {
            return false;
        }
        return WebpImage.read(image)
                .filter(w -> w.width() <= MAX_SIDE && w.height() <= MAX_SIDE)
                .isPresent();
    }

    static String shortHash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)).substring(0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void add(Map<String, Set<Long>> index, String title, Long songId) {
        index.computeIfAbsent(SongTitle.normalize(title), k -> new HashSet<>()).add(songId);
    }
}
