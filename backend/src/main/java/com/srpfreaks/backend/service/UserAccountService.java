package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.AppProperties;
import com.srpfreaks.backend.entity.Role;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.GoogleIdentity;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/** 구글 로그인으로 들어온 사람의 계정을 찾거나 만든다. */
@Service
@RequiredArgsConstructor
public class UserAccountService {

    private final UserRepository userRepository;
    private final AppProperties appProperties;

    /**
     * google_sub로 계정을 찾고, 없으면 만든다. 차단된 계정이나 이메일이 겹치는 경우는 모두 AUTH_FAILED다.
     * 이메일이 같다는 이유만으로 다른 구글 계정(다른 sub)에 기존 계정을 넘겨주지 않는다(계정 탈취 방지).
     */
    @Transactional
    public User findOrCreate(GoogleIdentity identity) {
        Optional<User> existing = userRepository.findByGoogleSub(identity.sub());
        if (existing.isPresent()) {
            return refresh(existing.get(), identity);
        }
        if (userRepository.findByEmail(identity.email()).isPresent()) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        try {
            return userRepository.save(User.create(identity.sub(), identity.email(), null, roleForNewUser(identity.email())));
        } catch (DataIntegrityViolationException e) {
            // 같은 사람이 동시에 첫 로그인을 두 번 보낸 경우 등 유니크 충돌. 다시 로그인하면 기존 계정으로 들어간다.
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
    }

    private User refresh(User user, GoogleIdentity identity) {
        if (!user.isActive()) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        if (!user.getEmail().equals(identity.email())) {
            // 구글 쪽 이메일이 바뀐 경우. 다른 사용자가 이미 쓰는 이메일이면 막는다.
            if (userRepository.findByEmail(identity.email()).isPresent()) {
                throw new ApiException(ErrorCode.AUTH_FAILED);
            }
            user.changeEmail(identity.email());
        }
        return user;
    }

    /**
     * ROOT 부트스트랩: 환경변수 ROOT_EMAIL과 같은 이메일로 "처음" 가입하는 계정만 ROOT가 된다.
     * 이미 ROOT가 있으면 USER다(ROOT는 1명). 기존 계정을 ROOT로 올려 주지는 않는다.
     */
    private Role roleForNewUser(String email) {
        String rootEmail = appProperties.getRootEmail();
        boolean matchesRootEmail = rootEmail != null && !rootEmail.isBlank() && rootEmail.strip().equalsIgnoreCase(email);
        if (matchesRootEmail && !userRepository.existsByRole(Role.ROOT)) {
            return Role.ROOT;
        }
        return Role.USER;
    }
}
