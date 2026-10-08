package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** 감사 로그 조회/저장. */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /**
     * 최근 순 목록. actor는 LAZY 연관이라 그냥 읽으면 줄마다 사용자 조회가 한 번씩 더 나간다(N+1).
     * @EntityGraph로 목록 쿼리에 사용자를 함께 가져오게 한다(작업한 사람이 없는 줄도 나오도록 LEFT JOIN).
     * created_at이 같은 줄이 있을 수 있어 id로도 정렬해 페이지 경계가 흔들리지 않게 한다.
     */
    @EntityGraph(attributePaths = "actor")
    Page<AuditLog> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
