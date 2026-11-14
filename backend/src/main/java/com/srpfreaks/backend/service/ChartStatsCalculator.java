package com.srpfreaks.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 서열표 분석(D77)의 계산 정의. 상태가 없는 순수 계산이라 DB 없이 테스트한다(수식의 모양이 코드 한 곳에만 있도록).
 * 계산은 반올림하지 않은 BigDecimal로 하고, 화면에 내보낼 때만 {@link #display}로 둘째 자리까지 반올림한다(레이팅과 같은 원칙, D20).
 *
 * 이 클래스는 "판정"을 하지 않는다. 숫자(평균·중앙값·폴더 평균·편차·증감)만 만들고, 쉬움/어려움 같은 라벨은 어디에도 없다.
 */
public final class ChartStatsCalculator {

    /** 곡(채보) 평균·중앙값을 내는 데 필요한 최소 플레이어 수. 그보다 적으면 null("표본 부족"). 개인이 드러나지 않게 하는 기준이기도 하다. */
    public static final int MIN_PLAYERS = 3;
    /** 폴더 평균을 내는 데 필요한 비교 채보 수(표본이 충분한 다른 채보). 그보다 적으면 null("폴더 표본 부족"). */
    public static final int MIN_FOLDER_CHARTS = 3;

    private static final int SCALE = 6;

    private ChartStatsCalculator() {
    }

    /** 폴더 계산에 쓰는 채보 한 개의 평균. avg가 null이면 표본 부족이라 폴더 평균에서 빠진다. */
    public record ChartAvg(Long chartId, BigDecimal tier, BigDecimal avg) {
    }

    /** 폴더(같은 기준 난이도) 한 줄. avg는 표본이 충분한 채보가 {@link #MIN_FOLDER_CHARTS}개 이상일 때만 있다. delta는 이전 표본 충분 폴더 대비 증감. */
    public record FolderStat(BigDecimal tier, int chartCount, int sampledCharts, BigDecimal avg, BigDecimal delta) {
    }

    /** 유저별 최고 달성률의 평균. 플레이어가 {@link #MIN_PLAYERS}명 미만이면 null. sum은 유저별 최고 달성률의 합이다. */
    public static BigDecimal average(BigDecimal sum, int players) {
        if (players < MIN_PLAYERS) {
            return null;
        }
        return sum.divide(BigDecimal.valueOf(players), SCALE, RoundingMode.HALF_UP);
    }

    /** 유저별 최고 달성률의 중앙값. 짝수 명이면 가운데 두 값의 평균. 플레이어가 {@link #MIN_PLAYERS}명 미만이면 null. */
    public static BigDecimal median(List<BigDecimal> bestRates) {
        if (bestRates.size() < MIN_PLAYERS) {
            return null;
        }
        List<BigDecimal> sorted = bestRates.stream().sorted().toList();
        int n = sorted.size();
        if (n % 2 == 1) {
            return sorted.get(n / 2).setScale(SCALE, RoundingMode.HALF_UP);
        }
        return sorted.get(n / 2 - 1).add(sorted.get(n / 2)).divide(BigDecimal.valueOf(2), SCALE, RoundingMode.HALF_UP);
    }

    /**
     * 폴더 평균: 같은 폴더의 "다른" 채보들의 평균을 다시 평균(채보마다 같은 비중). 보고 있는 채보(selfId)와 표본 부족 채보는 뺀다.
     * 남은 채보가 {@link #MIN_FOLDER_CHARTS}개 미만이면 null. selfId가 null이면 아무도 빼지 않는다(폴더 곡선용).
     */
    public static BigDecimal folderAverage(Long selfId, List<ChartAvg> sameFolder) {
        List<BigDecimal> others = sameFolder.stream()
                .filter(c -> !c.chartId().equals(selfId) && c.avg() != null)
                .map(ChartAvg::avg)
                .toList();
        if (others.size() < MIN_FOLDER_CHARTS) {
            return null;
        }
        return others.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(others.size()), SCALE, RoundingMode.HALF_UP);
    }

    /** 편차 = 곡 평균 - 폴더 평균(달성률 %p). 어느 한쪽이 없으면 null. */
    public static BigDecimal deviation(BigDecimal avg, BigDecimal folderAvg) {
        if (avg == null || folderAvg == null) {
            return null;
        }
        return avg.subtract(folderAvg);
    }

    /**
     * 폴더 곡선: 기준 난이도(0.1 단위)별 곡 수·평균·이전 폴더 대비 증감. 기준 난이도 오름차순.
     * 표본 부족 폴더(avg가 null)는 선에서 건너뛴다: 증감은 "이전에 표본이 충분했던 폴더"와 비교한다.
     *
     * @param chartCounts 폴더별 서열표 채보 수(기록이 없는 채보도 센다)
     * @param charts      기록이 있는 채보들의 평균(기준 난이도가 있는 것만)
     */
    public static List<FolderStat> folderCurve(Map<BigDecimal, Integer> chartCounts, List<ChartAvg> charts) {
        Map<BigDecimal, List<ChartAvg>> byTier = new TreeMap<>();
        chartCounts.keySet().forEach(tier -> byTier.put(tier.setScale(1, RoundingMode.UNNECESSARY), new ArrayList<>()));
        for (ChartAvg chart : charts) {
            byTier.computeIfAbsent(chart.tier().setScale(1, RoundingMode.UNNECESSARY), k -> new ArrayList<>()).add(chart);
        }
        List<FolderStat> result = new ArrayList<>();
        BigDecimal previous = null;
        for (Map.Entry<BigDecimal, List<ChartAvg>> folder : byTier.entrySet()) {
            int sampled = (int) folder.getValue().stream().filter(c -> c.avg() != null).count();
            BigDecimal avg = folderAverage(null, folder.getValue());
            int total = chartCounts.entrySet().stream()
                    .filter(e -> e.getKey().compareTo(folder.getKey()) == 0)
                    .mapToInt(Map.Entry::getValue).findFirst().orElse(sampled);
            BigDecimal delta = avg != null && previous != null ? avg.subtract(previous) : null;
            if (avg != null) {
                previous = avg;
            }
            result.add(new FolderStat(folder.getKey(), Math.max(total, sampled), sampled, avg, delta));
        }
        return result;
    }

    /** 화면용: 소수 둘째 자리까지 반올림(HALF_UP). null은 그대로 null. */
    public static BigDecimal display(BigDecimal exact) {
        return exact == null ? null : exact.setScale(2, RoundingMode.HALF_UP);
    }
}
