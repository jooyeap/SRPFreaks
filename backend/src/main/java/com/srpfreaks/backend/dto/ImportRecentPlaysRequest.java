package com.srpfreaks.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 한 번에 보내는 최근 플레이. 공식 페이지 한 장이 5곡이고 전체가 20곡이라 20건까지만 받는다. */
public record ImportRecentPlaysRequest(@NotEmpty @Size(max = 20) List<@Valid ImportPlayRequest> plays) {
}
