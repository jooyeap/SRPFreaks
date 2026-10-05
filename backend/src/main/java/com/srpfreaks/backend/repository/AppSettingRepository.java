package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

/** 운영 설정 조회/저장. 키(setting_key)가 PK다. */
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {
}
