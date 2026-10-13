package com.srpfreaks.backend.security;

import com.srpfreaks.backend.entity.Role;

/** 인증된 요청의 사용자. SecurityContext의 principal로 들어가며 컨트롤러에서 @AuthenticationPrincipal로 받는다. */
public record AuthenticatedUser(Long id, Role role) {
}
