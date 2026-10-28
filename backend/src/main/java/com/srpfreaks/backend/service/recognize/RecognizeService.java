package com.srpfreaks.backend.service.recognize;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RecognizeResultResponse;
import com.srpfreaks.backend.dto.RecognizeResultResponse.SongCandidate;
import com.srpfreaks.backend.dto.RecognizeStatusResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.RecognizeUsage;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.SongTitle;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.SongTitleRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.service.RecognizeAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 사진 입력(D55): 사진 한 장을 읽어 입력 칸 값을 돌려준다. **저장하지 않는다**(기록 저장은 사용자가 확인한 뒤 기존 POST /records).
 *
 * 순서
 * 1. RecognizeAccessPolicy로 쓸 수 있는지 확인(꺼짐·권한·한도). 권한 판단은 그쪽 한 곳에만 있다.
 * 2. 파일 검사(1MB 이하, 앞부분으로 JPEG·PNG·WebP 확인). 이름·확장자는 믿지 않는다.
 * 3. 키가 없으면 여기서 멈춘다(사용량을 세지 않는다).
 * 4. 사용량 1장을 먼저 기록하고(실패해도 센다: 같은 사진을 반복해 보내 비용을 늘리는 것을 막는다) 모델을 부른다. 형식 오류는 한 번만 다시 부른다.
 * 5. 값 검증(달성률 0~100, 레벨 0~9.99, 정해진 파트·난이도)과 곡 찾기(정규화한 곡명, D13).
 * 사진 바이트는 이 메서드 안에서만 쓰고 저장·로그하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class RecognizeService {

    static final int MAX_BYTES = 1024 * 1024;
    private static final int MAX_CANDIDATES = 5;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal MAX_LEVEL = new BigDecimal("9.99");

    private final RecognizeAccessPolicy accessPolicy;
    private final VisionClient visionClient;
    private final SongDifficultyRepository songDifficultyRepository;
    private final SongTitleRepository songTitleRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public RecognizeResultResponse recognize(Long userId, Role role, byte[] image) {
        RecognizeStatusResponse status = accessPolicy.status(userId, role);
        if (!status.available()) {
            throw new ApiException(switch (status.reason()) {
                case "ROLE" -> ErrorCode.FORBIDDEN;
                case "WEEKLY_LIMIT", "DAILY_LIMIT" -> ErrorCode.RECOGNIZE_LIMIT;
                default -> ErrorCode.RECOGNIZE_UNAVAILABLE;
            });
        }
        String mediaType = mediaTypeOf(image);
        if (!visionClient.isConfigured()) {
            throw new ApiException(ErrorCode.RECOGNIZE_UNAVAILABLE);
        }
        accessPolicy.record(RecognizeUsage.of(userRepository.getReferenceById(userId), clock.instant()));

        VisionResult raw;
        try {
            raw = visionClient.read(image, mediaType);
        } catch (VisionClient.VisionException first) {
            try {
                raw = visionClient.read(image, mediaType);   // 한 번만 다시 시도(사용량은 이미 1장으로 셌다)
            } catch (VisionClient.VisionException second) {
                throw new ApiException(ErrorCode.RECOGNIZE_UNAVAILABLE);
            }
        }
        return toResponse(raw, Math.max(0, status.remaining() - 1));
    }

    /** 파일 앞부분(매직 넘버)으로 형식을 정한다. 지원하지 않거나 크기가 맞지 않으면 400. */
    static String mediaTypeOf(byte[] b) {
        if (b == null || b.length < 12 || b.length > MAX_BYTES) {
            throw new ApiException(ErrorCode.RECOGNIZE_BAD_IMAGE);
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        throw new ApiException(ErrorCode.RECOGNIZE_BAD_IMAGE);
    }

    RecognizeResultResponse toResponse(VisionResult raw, int remaining) {
        InstrumentPart part = enumOf(InstrumentPart.class, raw.part());
        DifficultyType difficulty = enumOf(DifficultyType.class, raw.difficulty());
        BigDecimal level = decimal(raw.level(), MAX_LEVEL);
        BigDecimal rate = rateOf(raw.achievementRate());
        // 풀콤보: 달성률 100.00이면 항상 true(D9), 아니면 모델의 표시 또는 Miss 0
        Boolean fullCombo = rate != null && rate.compareTo(HUNDRED) == 0 ? Boolean.TRUE
                : raw.fullCombo() != null ? raw.fullCombo()
                : raw.missCount() != null ? raw.missCount() == 0 : null;

        String title = raw.title() == null || raw.title().isBlank() ? null : raw.title().strip();
        Map<Long, SongDifficulty> anyChartBySong = new LinkedHashMap<>();
        Long chartId = null;
        if (title != null) {
            List<SongDifficulty> charts = songDifficultyRepository.findAllActiveWithSong();
            List<Long> songIds = songIdsOf(charts, title);
            for (SongDifficulty d : charts) {
                if (songIds.contains(d.getSong().getId())) {
                    anyChartBySong.putIfAbsent(d.getSong().getId(), d);
                    if (songIds.size() == 1 && d.getInstrumentPart() == part && d.getDifficultyType() == difficulty) {
                        chartId = d.getId();
                    }
                }
            }
        }
        List<SongCandidate> candidates = new ArrayList<>();
        for (SongDifficulty d : anyChartBySong.values()) {
            if (candidates.size() >= MAX_CANDIDATES) {
                break;
            }
            candidates.add(new SongCandidate(d.getSong().getId(), d.getSong().getTitle()));
        }
        return new RecognizeResultResponse(title, part == null ? null : part.name(), difficulty == null ? null : difficulty.name(),
                level, rate, fullCombo, raw.superRandomPlus(), chartId, candidates, remaining);
    }

    /** 곡 본명(정규화)이 같은 곡을 먼저, 없으면 표기·별칭(song_titles)으로 찾는다(가져오기 D34와 같은 규칙). */
    private List<Long> songIdsOf(List<SongDifficulty> charts, String title) {
        String normalized = SongTitle.normalize(title);
        List<Long> ids = new ArrayList<>();
        for (SongDifficulty d : charts) {
            Long id = d.getSong().getId();
            if (!ids.contains(id) && SongTitle.normalize(d.getSong().getTitle()).equals(normalized)) {
                ids.add(id);
            }
        }
        if (!ids.isEmpty()) {
            return ids;
        }
        List<Long> active = charts.stream().map(d -> d.getSong().getId()).distinct().toList();
        for (SongTitle t : songTitleRepository.findByNormalizedTitle(normalized)) {
            Long id = t.getSong().getId();
            if (active.contains(id) && !ids.contains(id)) {   // 삭제된 곡의 표기는 뺀다
                ids.add(id);
            }
        }
        return ids;
    }

    private static <E extends Enum<E>> E enumOf(Class<E> type, String value) {
        if (value == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, value.strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** 달성률: "MAX"는 100.00, 0.00~100.00 안이면 소수 둘째 자리로 반올림, 그 밖은 null(D16: 범위 밖이면 비워 둔다). */
    static BigDecimal rateOf(String value) {
        if (value != null && value.strip().equalsIgnoreCase("MAX")) {
            return new BigDecimal("100.00");
        }
        return decimal(value == null ? null : value.replace("%", ""), HUNDRED);
    }

    private static BigDecimal decimal(String value, BigDecimal max) {
        if (value == null) {
            return null;
        }
        try {
            BigDecimal v = new BigDecimal(value.strip()).setScale(2, RoundingMode.HALF_UP);
            return v.signum() < 0 || v.compareTo(max) > 0 ? null : v;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
