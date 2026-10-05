package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.OptionRecord;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 옵션 기록 조회/저장. 항상 본인(userId) 범위로만 조회한다. */
public interface OptionRecordRepository extends JpaRepository<OptionRecord, Long> {

    /**
     * 기록 id와 소유자를 함께 조건으로 건다.
     * 타인의 기록이면 "없음"과 똑같이 비어 있게 되므로, 서비스는 이 결과로 404를 응답해 존재 여부를 숨긴다.
     */
    Optional<OptionRecord> findByIdAndUserId(Long optionRecordId, Long userId);

    Page<OptionRecord> findByUserId(Long userId, Pageable pageable);
}
