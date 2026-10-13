package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.config.JwtProperties;
import com.srpfreaks.backend.entity.RefreshToken;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.RefreshTokenRepository;
import com.srpfreaks.backend.security.RefreshTokenCodec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Refresh Token 발급, 재발급(Rotation), 폐기.
 *
 * Rotation: 재발급할 때마다 새 토큰을 주고 쓴 토큰은 폐기한다. 토큰이 하나라도 새어도 한 번 쓰이면 무효가 된다.
 * 재사용 탐지: 이미 폐기된 토큰이 다시 오면 누군가 훔친 토큰을 쓰고 있을 수 있으므로,
 *              같은 로그인(family)에서 나온 토큰을 전부 폐기해서 공격자와 정상 사용자를 모두 로그아웃시킨다.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProperties jwtProperties;
    private final Clock clock;

    /** 쿠키에 담을 원문 토큰과 만료 시각. 원문은 이 순간에만 존재하고 DB에는 해시만 저장된다. */
    public record IssuedToken(String rawToken, Instant expiresAt) {
    }

    /** 재발급 결과: 토큰의 주인과 새 토큰. */
    public record Rotation(User user, IssuedToken token) {
    }

    /** 새 로그인(= 새 family)의 첫 Refresh Token을 발급한다. */
    @Transactional
    public IssuedToken issueForNewLogin(User user) {
        return issue(user, UUID.randomUUID().toString());
    }

    /**
     * 쿠키로 받은 Refresh Token을 새 토큰으로 바꾼다.
     * 실패 이유는 모두 AUTH_FAILED 하나로 응답한다(없는 토큰, 만료, 재사용, 차단된 사용자를 구분하지 않는다).
     *
     * noRollbackFor: 재사용을 탐지했을 때 "family 폐기"를 저장한 뒤 예외를 던진다.
     * 기본 설정이면 예외 때문에 트랜잭션이 롤백되어 폐기가 취소되므로 ApiException은 롤백하지 않게 한다.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > RefreshTokenCodec.MAX_RAW_LENGTH) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        RefreshToken current = refreshTokenRepository
                .findForUpdateByTokenHash(RefreshTokenCodec.hash(rawToken))
                .orElseThrow(() -> new ApiException(ErrorCode.AUTH_FAILED));

        Instant now = clock.instant();
        if (current.isRevoked()) {
            // 이미 쓴(폐기된) 토큰이 또 왔다 = 재사용 탐지
            refreshTokenRepository.revokeFamily(current.getFamilyId(), now);
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        if (current.isExpired(now)) {
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }
        User user = current.getUser();
        if (!user.isActive()) {
            refreshTokenRepository.revokeFamily(current.getFamilyId(), now);
            throw new ApiException(ErrorCode.AUTH_FAILED);
        }

        current.revoke(now);
        return new Rotation(user, issue(user, current.getFamilyId()));
    }

    /** 로그아웃: 이 토큰이 속한 로그인(family)의 토큰을 모두 폐기한다. 토큰이 없거나 이미 무효여도 조용히 끝낸다. */
    @Transactional
    public void revokeFamilyOf(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > RefreshTokenCodec.MAX_RAW_LENGTH) {
            return;
        }
        refreshTokenRepository.findByTokenHash(RefreshTokenCodec.hash(rawToken))
                .ifPresent(token -> refreshTokenRepository.revokeFamily(token.getFamilyId(), clock.instant()));
    }

    private IssuedToken issue(User user, String familyId) {
        String raw = RefreshTokenCodec.generate();
        Instant expiresAt = clock.instant().plusMillis(jwtProperties.getRefreshTokenValidity());
        refreshTokenRepository.save(RefreshToken.issue(user, familyId, RefreshTokenCodec.hash(raw), expiresAt));
        return new IssuedToken(raw, expiresAt);
    }
}
