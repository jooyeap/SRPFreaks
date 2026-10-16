package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Suggestion;
import com.srpfreaks.backend.entity.SuggestionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;

/**
 * 건의 조회/저장. 관리자 목록은 종류·상태 필터가 선택 조건이라 Specification으로 조립한다
 * (선택 조건을 JPQL의 ":x is null or ..."로 쓰면 enum 파라미터의 null 바인딩이 DB마다 다르게 동작할 수 있다).
 */
public interface SuggestionRepository extends JpaRepository<Suggestion, Long>, JpaSpecificationExecutor<Suggestion> {

    /** 내 건의, 최근 순. created_at이 같을 수 있어 id로도 정렬한다. */
    Page<Suggestion> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    /** 하루 보내기 제한용: since 이후에 내가 보낸 건의 수. */
    long countByUserIdAndCreatedAtAfter(Long userId, Instant since);

    long countByStatus(SuggestionStatus status);
}
