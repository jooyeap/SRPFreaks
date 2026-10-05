package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.UserResponse;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 로그인한 본인의 프로필(닉네임) 변경. */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;

    /**
     * 본인 닉네임을 바꾼다. 대상은 토큰에서 나온 userId뿐이다(다른 사용자의 닉네임은 바꿀 수 없다).
     * 규칙에 어긋나면 User.changeNickname이 IllegalArgumentException을 던지고, 공통 예외 처리가 400으로 응답한다.
     * 별도 save 호출이 없는 이유: 트랜잭션 안에서 조회한 엔티티는 변경 감지(dirty checking)로 커밋 때 UPDATE된다.
     */
    @Transactional
    public UserResponse updateNickname(Long userId, String nickname) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        user.changeNickname(nickname);
        return UserResponse.from(user);
    }
}
