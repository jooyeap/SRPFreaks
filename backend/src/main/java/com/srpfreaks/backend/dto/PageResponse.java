package com.srpfreaks.backend.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/** 목록 응답 공통 형식. 스프링의 Page를 그대로 내보내지 않고 필요한 값만 담는다. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
