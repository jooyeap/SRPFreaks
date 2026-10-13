package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.ImportTokenIssueResponse;
import com.srpfreaks.backend.dto.ImportTokenStatusResponse;
import com.srpfreaks.backend.entity.ImportToken;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.repository.ImportTokenRepository;
import com.srpfreaks.backend.repository.UserRepository;
import com.srpfreaks.backend.security.RefreshTokenCodec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

/**
 * 가져오기 전용 토큰 발급·폐기·확인(D34).
 *
 * 토큰 모양: `srpi_` + 난수 32바이트(Base64url). 접두어가 있으면 코드 저장소·로그에 실수로 올라온 값을
 * 비밀값 스캐너가 알아보기 쉽다. 난수와 해시는 RefreshTokenCodec을 그대로 쓴다(DB에는 해시만 저장).
 * 사용자당 쓸 수 있는 토큰은 하나다: 새로 발급하면 이전 토큰은 바로 폐기된다.
 */
@Service
@RequiredArgsConstructor
public class ImportTokenService {

    public static final String PREFIX = "srpi_";
    /** 정상 토큰은 48자(접두어 5 + 난수 43)다. 이보다 훨씬 긴 값은 해시하지 않고 거부한다. */
    static final int MAX_RAW_LENGTH = 128;

    private final ImportTokenRepository importTokenRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    /** 새 토큰을 발급한다. 이전 토큰은 폐기된다. 원문은 이 응답에만 있다. */
    @Transactional
    public ImportTokenIssueResponse issue(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        Instant now = clock.instant();
        importTokenRepository.revokeAllActiveOf(userId, now);

        String raw = PREFIX + RefreshTokenCodec.generate();
        ImportToken saved = importTokenRepository.save(ImportToken.issue(user, RefreshTokenCodec.hash(raw)));
        // createdAt은 저장 시점에 엔티티가 채우므로, 응답에는 같은 값을 쓰도록 저장된 엔티티에서 읽는다
        return new ImportTokenIssueResponse(raw, saved.getCreatedAt());
    }

    /** 내 토큰을 폐기한다. 없어도 조용히 끝난다(여러 번 눌러도 같은 결과). */
    @Transactional
    public void revoke(Long userId) {
        importTokenRepository.revokeAllActiveOf(userId, clock.instant());
    }

    @Transactional(readOnly = true)
    public ImportTokenStatusResponse status(Long userId) {
        return importTokenRepository.findFirstByUserIdAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
                .map(t -> new ImportTokenStatusResponse(true, t.getCreatedAt(), t.getLastUsedAt()))
                .orElseGet(ImportTokenStatusResponse::none);
    }

    /**
     * 가져오기 요청에서 받은 원문 토큰으로 사용자를 찾는다. 이유와 상관없이 실패는 빈 값이다
     * (형식이 틀림, 없는 토큰, 폐기됨, 차단된 사용자를 구분해 알려 주지 않는다).
     * 성공하면 마지막 사용 시각을 갱신한다.
     */
    @Transactional
    public Optional<Long> authenticate(String rawToken) {
        if (rawToken == null || !rawToken.startsWith(PREFIX) || rawToken.length() > MAX_RAW_LENGTH) {
            return Optional.empty();
        }
        return importTokenRepository.findByTokenHash(RefreshTokenCodec.hash(rawToken))
                .filter(t -> !t.isRevoked())
                .filter(t -> t.getUser().isActive())
                .map(t -> {
                    t.markUsed(clock.instant());
                    return t.getUser().getId();
                });
    }
}
