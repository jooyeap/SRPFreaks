package com.srpfreaks.backend.repository;

import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.entity.UserStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자 조회/저장. */
public interface UserRepository extends JpaRepository<User, Long> {

    /** 구글 로그인: 구글 계정 고유 ID(sub)로 사용자를 찾는다. */
    Optional<User> findByGoogleSub(String googleSub);

    Optional<User> findByEmail(String email);

    /** ROOT는 1명만 둔다. ROOT 계정이 이미 있는지 확인할 때 쓴다. */
    boolean existsByRole(Role role);

    /** 유저 목록(D26): 공개를 켠 유저 중 지정한 상태(ACTIVE)인 사람만. 이메일 등은 서비스가 응답에 넣지 않는다. */
    List<User> findByProfilePublicTrueAndStatus(UserStatus status);

    /** 유저 상세(D26): 공개를 켠 ACTIVE 유저 한 명. 비공개·차단·없는 유저는 모두 빈 값이라 서비스가 똑같이 404로 응답한다. */
    Optional<User> findByIdAndProfilePublicTrueAndStatus(Long id, UserStatus status);
}
