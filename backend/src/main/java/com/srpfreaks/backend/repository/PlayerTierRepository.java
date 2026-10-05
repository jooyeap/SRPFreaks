package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.PlayerTier;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 플레이어 티어 구간표 조회. */
public interface PlayerTierRepository extends JpaRepository<PlayerTier, Long> {

    List<PlayerTier> findAllByOrderBySortOrderAsc();
}
