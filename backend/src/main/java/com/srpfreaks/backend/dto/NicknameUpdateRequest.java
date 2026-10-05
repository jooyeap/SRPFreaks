package com.srpfreaks.backend.dto;

import jakarta.validation.constraints.Size;

/**
 * 닉네임 변경 요청. 빈 값(또는 null)은 "닉네임 없음"으로 되돌린다는 뜻이다.
 * 길이·허용 문자의 실제 규칙은 정규화(NFKC) 뒤에 User 엔티티가 검사한다(docs/DESIGN.md "닉네임 규칙").
 * 여기서는 정규화 전의 지나치게 긴 입력만 먼저 막는다. NFKC는 글자를 늘릴 수 있어서 12보다 넉넉하게 둔다.
 */
public record NicknameUpdateRequest(
        @Size(max = 50, message = "닉네임을 확인해 주세요.")
        String nickname) {
}
