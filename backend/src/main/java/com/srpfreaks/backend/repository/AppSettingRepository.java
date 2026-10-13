package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/** 운영 설정 조회/저장. 키(setting_key)가 PK다. */
public interface AppSettingRepository extends JpaRepository<AppSetting, String> {

    /**
     * 관리 화면용 전체 목록. updatedBy는 LAZY라 줄마다 사용자 조회가 더 나가지 않도록(N+1) fetch join 한다.
     * 설정은 마이그레이션이 정한 십여 개뿐이라 정렬과 페이지 자르기는 서비스가 메모리에서 한다
     * (키 이름 `key`가 HQL 예약어와 겹쳐 order by를 쿼리에 쓰기 꺼림칙한 점도 피한다).
     */
    @Query("select s from AppSetting s left join fetch s.updatedBy")
    List<AppSetting> findAllWithUpdatedBy();
}
