package com.srpfreaks.backend.mapper;

import java.time.LocalDate;

/** 관리자 대시보드(D80): 한국 시간 하루(day)와 그날의 개수. 개인 식별 값은 없다. */
public record DayCountRow(LocalDate day, long count) {
}
