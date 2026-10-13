package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.dto.DifficultyCreateRequest;
import com.srpfreaks.backend.dto.DifficultyResponse;
import com.srpfreaks.backend.dto.DifficultyUpdateRequest;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 채보 관리 API (ROOT·ADMIN). 조회는 곡 상세(GET /songs/{id})에 포함되어 있다. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DifficultyController {

    private final SongAdminService songAdminService;

    @PostMapping("/songs/{songId}/difficulties")
    public ResponseEntity<DifficultyResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                                     @PathVariable Long songId,
                                                     @Valid @RequestBody DifficultyCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(songAdminService.createDifficulty(actor.id(), songId, request));
    }

    @PutMapping("/difficulties/{difficultyId}")
    public DifficultyResponse update(@AuthenticationPrincipal AuthenticatedUser actor,
                                     @PathVariable Long difficultyId,
                                     @Valid @RequestBody DifficultyUpdateRequest request) {
        return songAdminService.updateDifficulty(actor.id(), difficultyId, request);
    }

    @DeleteMapping("/difficulties/{difficultyId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser actor,
                                       @PathVariable Long difficultyId) {
        songAdminService.deleteDifficulty(actor.id(), difficultyId);
        return ResponseEntity.noContent().build();
    }
}
