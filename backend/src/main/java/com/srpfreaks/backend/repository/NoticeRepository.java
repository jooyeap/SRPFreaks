package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** 공지사항 조회/저장. author는 응답에 쓰지 않아 LAZY로 두고 읽지 않는다. */
public interface NoticeRepository extends JpaRepository<Notice, Long> {

    /** 최근 순. created_at이 같은 줄이 있을 수 있어 id로도 정렬해 페이지 경계가 흔들리지 않게 한다. */
    Page<Notice> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
