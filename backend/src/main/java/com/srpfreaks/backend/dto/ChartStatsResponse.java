package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.dto.SkillResponse.PlayerTierResponse;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 서열표 분석(D77)의 응답 모양들. ROOT·ADMIN만 받는 읽기 전용 숫자다.
 *
 * 개인정보: 공개(profile_public) + ACTIVE 유저의 SRN+ 기록만 집계한다. 이메일·역할·Google ID는 필드로 만들지 않았다(실수로 내보낼 수 없게).
 * 유저가 드러나는 곳은 {@link PlayerRow}뿐이고, 거기도 유저 목록(D26)에서 이미 보이는 값(닉네임·티어·총점)과 이 채보의 본인 기록뿐이다.
 * 판정 라벨(쉬움/어려움 후보, 역전, 적정 등)은 어디에도 없다. 숫자와 순서만 있다.
 *
 * 평균·중앙값·폴더 평균·편차가 null이면 표본 부족이다(플레이어 3명 미만, 폴더 비교 채보 3개 미만). 숫자는 소수 둘째 자리까지 반올림해서 내보낸다.
 */
public final class ChartStatsResponse {

    private ChartStatsResponse() {
    }

    /** 목록 응답 공통 틀: 페이지 + 집계 기준(화면의 "집계 기준" 안내가 쓰는 값). */
    public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages, Meta meta) {
    }

    /** publicUsers = 집계 기준의 공개 유저 수, minPlayers/minFolderCharts = 표본 기준, recentDays = 최근 기록 증가분의 기간(일). */
    public record Meta(int publicUsers, int minPlayers, int minFolderCharts, int recentDays) {
    }

    /** 채보의 이름. tier는 서열표 기준 난이도(0.1 단위)이고 없으면 null(미정). */
    public record Chart(Long songDifficultyId, Long songId, String title, InstrumentPart part, DifficultyType difficulty,
                        BigDecimal level, BigDecimal tier) {
    }

    /** 편차 목록 한 줄. deviation = avgRate - folderAvgRate(%p). folderSampleCharts = 폴더 평균에 쓴 비교 채보 수. */
    public record DeviationRow(Chart chart, int players, long records, BigDecimal avgRate, BigDecimal folderAvgRate,
                               BigDecimal deviation, int folderSampleCharts) {
    }

    /** 인기 목록 한 줄. records = 저장 횟수, players = 사람 수, recentRecords = 최근 7일 증가분(Asia/Seoul 달력 기준). */
    public record PopularityRow(Chart chart, long records, int players, long recentRecords) {
    }

    /** 폴더 한 줄. chartCount = 서열표 채보 수(기록 없는 채보 포함), sampledCharts = 평균에 쓴 표본 충분 채보 수. avgRate가 null이면 폴더 표본 부족. */
    public record FolderRow(BigDecimal tier, int chartCount, int sampledCharts, BigDecimal avgRate, BigDecimal deltaFromPrevious) {
    }

    /** 미정 목록 한 줄: 서열표 기준 난이도가 없는데 공개 유저 기록이 있는 채보(서열표에 아예 없는 채보 포함). */
    public record UndecidedRow(Chart chart, long records, int players) {
    }

    /** 채보 요약(곡 상세 관리자 카드·유저별 상세 맨 위). 기록이 없는 채보도 0명으로 내려간다. */
    public record Summary(Chart chart, int players, long records, BigDecimal avgRate, BigDecimal medianRate,
                          BigDecimal folderAvgRate, BigDecimal deviation, int folderSampleCharts, Meta meta) {
    }

    /** 채보별 공개 유저 한 줄. 총점·티어는 그 유저의 레이팅(유저 목록 D26과 같은 계산)이다. */
    public record PlayerRow(Long userId, String nickname, PlayerTierResponse tier, BigDecimal totalScore, BigDecimal bestRate,
                            long playCount, Instant lastPlayedAt) {
    }
}
