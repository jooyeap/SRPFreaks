package com.gitalog.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import com.gitalog.backend.config.JwtProperties;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

	private final JwtProperties jwtProperties;
	
	private SecretKey getSigningKey() {
		return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
	}
	
	public String generateAccessToken(String username) {
		return generateToken(username, jwtProperties.getAccessTokenValidity());
	}
	
	public String generateRefreshToken(String username) {
		return generateToken(username, jwtProperties.getRefreshTokenValidity());
	}
	
	private String generateToken(String username, long validityMs) {
		Date now = new Date();
		Date expiry = new Date(now.getTime() + validityMs);
		
		return Jwts.builder()
				.subject(username)
				.issuedAt(now)
				.expiration(expiry)
				.signWith(getSigningKey())
				.compact();
	}
	
	public String getUsernameFromToken(String token) {
		Claims claims = Jwts.parser()
				.verifyWith(getSigningKey())
				.build()
				.parseSignedClaims(token)
				.getPayload();
		return claims.getSubject();
	}
	
	public boolean validateToken(String token) {
		try {
			Jwts.parser()
					.verifyWith(getSigningKey())
					.build()
					.parseSignedClaims(token);
			return true;
		} catch (Exception e) {
			return false;
		}
	}
}
