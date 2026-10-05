package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 감사 로그 조회/저장. */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
