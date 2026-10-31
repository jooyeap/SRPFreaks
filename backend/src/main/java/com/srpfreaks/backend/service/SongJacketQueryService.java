package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongJacketsResponse;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.SongRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 재킷 주소 목록(D54 3단계, 로그인 없이 읽는 공개 GET). 운영 설정 `ui.show_song_images`가 "true"일 때만 주소를 내보낸다.
 * 주소는 우리 사이트의 `/jackets/{songId}.webp?v=…`뿐이다(저장할 때 서버가 만든 값, 외부 주소 없음).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongJacketQueryService {

    static final String SETTING_KEY = "ui.show_song_images";

    private final AppSettingRepository appSettingRepository;
    private final SongRepository songRepository;

    public SongJacketsResponse jackets() {
        boolean enabled = appSettingRepository.findById(SETTING_KEY)
                .map(s -> "true".equals(s.getValue()))
                .orElse(false);
        if (!enabled) {
            return new SongJacketsResponse(false, Map.of());
        }
        Map<Long, String> map = new LinkedHashMap<>();
        songRepository.findAllJacketUrls().forEach(row -> map.put(row.songId(), row.text()));
        return new SongJacketsResponse(true, map);
    }
}
