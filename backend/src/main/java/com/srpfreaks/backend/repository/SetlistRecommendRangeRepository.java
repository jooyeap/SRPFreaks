package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.SetlistRecommendRange;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** 사용자별 추천 범위. 모든 조회·삭제가 user_id로 좁혀져 남의 설정은 섞이지 않는다. */
public interface SetlistRecommendRangeRepository extends JpaRepository<SetlistRecommendRange, Long> {

    Optional<SetlistRecommendRange> findByUserId(Long userId);

    /** 기본값으로 되돌릴 때 쓴다. 줄이 없으면 아무 일도 없다(여러 번 눌러도 같은 결과). */
    void deleteByUserId(Long userId);
}
