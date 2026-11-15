package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.SuggestionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 관리자 대시보드(D80)의 응답 모양들. ROOT만 받는 읽기 전용 집계 숫자다.
 *
 * 개인정보: 개인이 드러나는 값은 어디에도 없다. 이메일·닉네임·유저 id·개인 기록을 필드로 만들지 않았다(실수로 내보낼 수 없게).
 * 모두 "몇 명, 몇 건"이라는 합계와 날짜별 개수, 티어별 인원수뿐이다. 날짜는 모두 Asia/Seoul 하루 단위다.
 * 방문자 수·페이지뷰는 없다(수집 장치가 없다).
 */
public final class DashboardResponse {

    private DashboardResponse() {
    }

    /**
     * days = 요청한 기간(7/30/90일, 오늘 포함), zone = 날짜를 묶은 시간대, from~to = 기간의 첫날과 마지막 날(오늘, 포함).
     * signups·records는 기간의 모든 날을 담는다(없는 날은 0).
     */
    public record Dashboard(int days, String zone, LocalDate from, LocalDate to, Summary summary, List<SignupPoint> signups,
                            List<RecordPoint> records, TierDistribution tiers, List<SuggestionStatusCount> suggestions) {
    }

    /**
     * totalUsers = 전체 가입자(차단 포함), newUsers = 기간 안에 늘어난 가입자,
     * publicProfiles = 공개 프로필(공개 + ACTIVE + 닉네임 있음) 수, publicRatioPercent = publicProfiles ÷ totalUsers × 100(소수 첫째 자리, 가입자가 0명이면 null),
     * recordsToday·recordsYesterday = 한국 시간 오늘·어제 저장된 기록 건수, pendingSuggestions = 아직 처리하지 않은(접수) 건의 수.
     */
    public record Summary(long totalUsers, long newUsers, long publicProfiles, BigDecimal publicRatioPercent, long recordsToday,
                          long recordsYesterday, long pendingSuggestions) {
    }

    /** 가입자 추이 한 점: 그날 새로 가입한 수(newUsers)와 그날 끝까지의 누적(totalUsers). */
    public record SignupPoint(LocalDate date, long newUsers, long totalUsers) {
    }

    /** 기록 입력 수 한 점: 그날 저장된 기록 건수. */
    public record RecordPoint(LocalDate date, long records) {
    }

    /**
     * 플레이어 티어 분포. basis는 항상 PUBLIC_PROFILES: 비공개 유저의 기록은 읽지 않으므로 공개 프로필 유저만 센다.
     * recordedUsers = SRN+ 기록이 있는 전체 유저 수(비공개 포함, 개수만), countedUsers = 그중 티어를 계산해 분포에 넣은 공개 유저 수.
     * rows는 인원이 있는 티어만, 낮은 티어부터다.
     */
    public record TierDistribution(String basis, long recordedUsers, long countedUsers, List<TierRow> rows) {
    }

    /** 티어 한 줄: 티어 이름과 그 티어의 공개 유저 수. 유저는 드러나지 않는다. */
    public record TierRow(String key, String displayName, int minScore, long users) {
    }

    /** 건의 처리 상태별 개수. 상태 이름은 서버의 SuggestionStatus 그대로다(RECEIVED·REVIEWING·DONE·REJECTED). */
    public record SuggestionStatusCount(SuggestionStatus status, long count) {
    }
}
