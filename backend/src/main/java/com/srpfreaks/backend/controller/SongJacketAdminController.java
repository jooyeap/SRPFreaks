package com.srpfreaks.backend.controller;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.SongJacketMatchRequest;
import com.srpfreaks.backend.dto.SongJacketMatchResponse;
import com.srpfreaks.backend.dto.SongJacketSaveResponse;
import com.srpfreaks.backend.security.AuthenticatedUser;
import com.srpfreaks.backend.service.SongJacketAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 재킷 이미지 가져오기(D54). 매칭·저장은 ROOT만, 삭제(내리기)는 ROOT·ADMIN.
 * 이미지는 ROOT의 브라우저가 공식 페이지에서 읽어 200px WebP로 줄인 것이고, 서버는 공식 사이트와 통신하지 않는다.
 */
@RestController
@RequestMapping("/api/v1/admin/song-jackets")
@RequiredArgsConstructor
public class SongJacketAdminController {

    private final SongJacketAdminService service;

    /** 공식 곡명 목록을 마스터와 맞춰 본다(저장하지 않는다). */
    @PostMapping("/match")
    @PreAuthorize("hasRole('ROOT')")
    public SongJacketMatchResponse match(@Valid @RequestBody SongJacketMatchRequest request) {
        return service.match(request.titles());
    }

    /** multipart: songIds(같은 이름의 칸 여러 개)와 images(같은 순서), 한 번에 10장까지. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ROOT')")
    public SongJacketSaveResponse save(@AuthenticationPrincipal AuthenticatedUser actor,
                                       @RequestParam("songIds") List<Long> songIds,
                                       @RequestParam("images") List<MultipartFile> images) {
        if (images.size() > SongJacketAdminService.MAX_PER_REQUEST) {
            throw new ApiException(ErrorCode.JACKET_BAD_IMAGE);
        }
        List<byte[]> bytes = new ArrayList<>();
        for (MultipartFile image : images) {
            try {
                bytes.add(image.getBytes());
            } catch (IOException e) {
                throw new ApiException(ErrorCode.JACKET_BAD_IMAGE);
            }
        }
        return service.save(actor.id(), songIds, bytes);
    }

    @DeleteMapping("/{songId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long songId) {
        service.delete(actor.id(), songId);
    }
}
