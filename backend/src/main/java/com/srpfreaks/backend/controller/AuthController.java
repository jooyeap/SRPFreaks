package com.srpfreaks.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.srpfreaks.backend.dto.auth.AuthResponse;
import com.srpfreaks.backend.dto.auth.LoginRequest;
import com.srpfreaks.backend.dto.auth.SignupRequest;
import com.srpfreaks.backend.service.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
	
	private final AuthService authService;
	
	@PostMapping("/signup")
	public ResponseEntity<AuthResponse> signup(
			@Valid
			@RequestBody SignupRequest request
	) {
		return ResponseEntity.ok(authService.signup(request));
	}
	
	@PostMapping("/login")
	public ResponseEntity<AuthResponse> login(
			@Valid
			@RequestBody LoginRequest request
	) {
		return ResponseEntity.ok(authService.login(request));
	}
}
