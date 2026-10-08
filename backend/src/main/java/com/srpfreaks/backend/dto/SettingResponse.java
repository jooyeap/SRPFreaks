package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.AppSetting;

import java.time.Instant;

/** 운영 설정 한 줄 (ROOT 전용 화면). 바꾼 사람은 닉네임만 내보내고, 처음 값(시드)이나 탈퇴한 사람이면 null이다. */
public record SettingResponse(String key, String value, String updatedByNickname, Instant updatedAt) {

    public static SettingResponse from(AppSetting setting) {
        return new SettingResponse(setting.getKey(), setting.getValue(),
                setting.getUpdatedBy() == null ? null : setting.getUpdatedBy().getNickname(), setting.getUpdatedAt());
    }
}
