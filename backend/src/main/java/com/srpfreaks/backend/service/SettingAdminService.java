package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.PageResponse;
import com.srpfreaks.backend.dto.SettingResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.entity.AuditLog;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.AuditLogRepository;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 운영 설정 조회·변경 (ROOT 전용). 새 키를 만들 수는 없고(키는 마이그레이션이 정한다) 있는 키의 값만 바꾼다.
 *
 * 잘못된 값이 저장되면 레이팅 화면이 전부 500이 되므로(RatingConfig.from이 예외를 던진다) 저장하기 전에 검사한다:
 *  - rating.* 키: 바꾼 값을 끼워 넣은 전체 설정으로 RatingConfig를 만들어 본다. 만들어지면 계산에 쓸 수 있는 값이다.
 *  - ui.show_song_images: true / false 만.
 *  - 그 밖의 키: 비어 있지 않은 글자.
 * 모든 변경은 audit_logs에 변경 전/후 값과 함께 남긴다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class SettingAdminService {

    public static final int DEFAULT_PAGE_SIZE = 50;
    public static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> BOOLEAN_KEYS = Set.of("ui.show_song_images");

    private final AppSettingRepository appSettingRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PageResponse<SettingResponse> list(int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pageIndex = Math.max(page, 0);
        List<AppSetting> all = appSettingRepository.findAllWithUpdatedBy().stream()
                .sorted(Comparator.comparing(AppSetting::getKey))
                .toList();
        int from = (int) Math.min((long) pageIndex * pageSize, all.size());
        int to = Math.min(from + pageSize, all.size());
        List<SettingResponse> content = all.subList(from, to).stream().map(SettingResponse::from).toList();
        int totalPages = (all.size() + pageSize - 1) / pageSize;
        return new PageResponse<>(content, pageIndex, pageSize, all.size(), totalPages);
    }

    public SettingResponse update(Long actorId, String key, String rawValue) {
        AppSetting setting = appSettingRepository.findById(key).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        String value = rawValue == null ? "" : rawValue.strip();
        validate(key, value);

        String before = setting.getValue();
        setting.change(value, userRepository.getReferenceById(actorId));

        // 값에 비밀이 들어갈 일은 없는 설정이라 전/후 값을 그대로 남긴다(무엇을 어떻게 바꿨는지가 기록의 목적이다).
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("before", before);
        detail.put("after", value);
        auditLogRepository.save(AuditLog.record(userRepository.getReferenceById(actorId),
                "SETTING_UPDATE", "SETTING", key, detail));
        return SettingResponse.from(setting);
    }

    /** 키별 값 검사. 틀리면 400(VALIDATION_ERROR). */
    private void validate(String key, String value) {
        if (value.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR);
        }
        if (BOOLEAN_KEYS.contains(key)) {
            if (!value.equals("true") && !value.equals("false")) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR);
            }
            return;
        }
        if (key.startsWith(RatingConfig.KEY_PREFIX)) {
            // 바꾼 값을 끼워 넣은 전체 설정으로 실제 계산 설정을 만들어 본다. 숫자가 아니거나 규칙에 어긋나면 IllegalStateException이다.
            Map<String, String> all = appSettingRepository.findAll().stream()
                    .collect(Collectors.toMap(AppSetting::getKey, AppSetting::getValue));
            all.put(key, value);
            try {
                RatingConfig.from(all);
            } catch (IllegalStateException e) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR);
            }
        }
    }
}
