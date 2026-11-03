package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 사용자 조회/저장. */
public interface UserRepository extends JpaRepository<User, Long> {

    /** 구글 로그인: 구글 계정 고유 ID(sub)로 사용자를 찾는다. */
    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByEmail(String email);

    /**
     * 사용자 한 명을 행 잠금(SELECT ... FOR UPDATE)으로 읽는다. 서열표 변경 알림(D61)을 만들 때 쓴다.
     * 헤더 종의 개수 요청과 목록 요청이 거의 동시에 오면, 잠그지 않으면 둘 다 같은 커서를 읽어 같은 알림을 두 번 만든다.
     * 잠그면 두 번째 요청은 첫 번째가 커밋(커서 이동)할 때까지 기다렸다가 옮겨진 커서를 읽는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /** ROOT는 1명만 둔다. ROOT 계정이 이미 있는지 확인할 때 쓴다. */
    boolean existsByRole(Role role);

    /** 유저 목록(D26): 공개를 켠 유저 중 지정한 상태(ACTIVE)인 사람만. 이메일 등은 서비스가 응답에 넣지 않는다. */
    List<User> findByProfilePublicTrueAndStatus(UserStatus status);

    /** 유저 상세(D26): 공개를 켠 ACTIVE 유저 한 명. 비공개·차단·없는 유저는 모두 빈 값이라 서비스가 똑같이 404로 응답한다. */
    Optional<User> findByIdAndProfilePublicTrueAndStatus(Long id, UserStatus status);

    /** 관리 화면(ROOT) 사용자 목록: 가입 순(id 오름차순). */
    Page<User> findAllByOrderByIdAsc(Pageable pageable);

    /**
     * 관리 화면 검색: 닉네임 또는 이메일에 검색어가 들어 있는 사용자(대소문자 무시), 가입 순.
     * 파생 쿼리의 Containing은 검색어 속 %, _ 를 일반 글자로 이스케이프해서 LIKE 와일드카드로 쓰이지 않는다.
     */
    Page<User> findByNicknameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrderByIdAsc(
            String nickname, String email, Pageable pageable);
}
