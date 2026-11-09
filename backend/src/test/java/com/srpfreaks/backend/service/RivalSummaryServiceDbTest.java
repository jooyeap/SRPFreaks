package com.srpfreaks.backend.service;

import com.srpfreaks.backend.common.error.ApiException;
import com.srpfreaks.backend.common.error.ErrorCode;
import com.srpfreaks.backend.dto.RivalSummaryDetailResponse;
import com.srpfreaks.backend.dto.RivalSummaryResponse;
import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.mapper.SkillMapper;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.DifficultyTableRepository;
import com.srpfreaks.backend.repository.OptionRecordRepository;
import com.srpfreaks.backend.repository.PlayerTierRepository;
import com.srpfreaks.backend.repository.RivalRepository;
import com.srpfreaks.backend.repository.SongDifficultyRepository;
import com.srpfreaks.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.boot.autoconfigure.MybatisAutoConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.time.Clock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 라이벌 대시보드 집계(D67)를 실제 MySQL(Flyway 스키마·기본 rating.* 설정)과 실제 레이팅 후보 쿼리로 확인한다. Docker가 필요하다.
 *
 * 점수는 직접 계산한 값이다. 기준 난이도 5.0은 상수 R=10*5.0-45=5라 달성률 80 이하에서 점수가 달성률과 같아서(V=5*A/100, 점수=V*20)
 * 접전 경계(±1.00, ±1.01)를 달성률 차이로 정확히 만들 수 있다. 기준 난이도 6.0은 R=15라 95%에서 304.00, 80%에서 240.00이다.
 */
@DataJpaTest
@ImportAutoConfiguration(MybatisAutoConfiguration.class)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.password=unused")
class RivalSummaryServiceDbTest {

    @Container
    @ServiceConnection
    static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

    @Autowired EntityManager em;
    @Autowired UserRepository userRepository;
    @Autowired RivalRepository rivalRepository;
    @Autowired OptionRecordRepository optionRecordRepository;
    @Autowired SongDifficultyRepository songDifficultyRepository;
    @Autowired AppSettingRepository appSettingRepository;
    @Autowired DifficultyTableRepository difficultyTableRepository;
    @Autowired PlayerTierRepository playerTierRepository;
    @Autowired SkillMapper skillMapper;

    RivalSummaryService service;
    User me;
    User rival;
    DifficultyTable table;
    int seq = 0;

    @BeforeEach
    void setUp() {
        SkillService skillService = new SkillService(appSettingRepository, difficultyTableRepository, playerTierRepository, skillMapper);
        RivalService rivalService = new RivalService(rivalRepository, userRepository, optionRecordRepository,
                songDifficultyRepository, appSettingRepository, skillService, Clock.systemUTC());
        service = new RivalSummaryService(rivalService, skillService);
        me = publicUser("sub-me", "Me");
        rival = publicUser("sub-rival", "Rumi");
        table = persist(DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS));
        build();
        em.flush();
        em.clear();
    }

    /** 채보 하나(서열표 줄 포함). tier/pattern이 null이면 비워 둔다. */
    private SongDifficulty chart(String tier, PatternType pattern, boolean ratingEnabled) {
        Song song = persist(Song.create("곡" + (++seq), null, "test", null));
        SongDifficulty d = persist(SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER, new BigDecimal("9.50")));
        DifficultyTableEntry e = DifficultyTableEntry.create(table, d);
        e.changeTier(tier == null ? null : new BigDecimal(tier), false, null);
        e.changePattern(pattern, false);
        e.changeRatingEnabled(ratingEnabled);
        persist(e);
        return d;
    }

    private void record(User user, SongDifficulty d, String rate) {
        record(user, d, NoteOption.SUPER_RANDOM_PLUS, rate);
    }

    private void record(User user, SongDifficulty d, NoteOption option, String rate) {
        persist(OptionRecord.create(user, d, option, new BigDecimal(rate), false, null, null, null));
    }

    private void both(SongDifficulty d, String myRate, String theirRate) {
        record(me, d, myRate);
        record(rival, d, theirRate);
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private User publicUser(String sub, String nickname) {
        User u = persist(User.create(sub, sub + "@example.com", nickname));
        u.changeProfilePublic(true);
        return u;
    }

    private SongDifficulty singleWin;
    private SongDifficulty compoundLoss;

    /**
     * 장면: 나(me) vs 라이벌(rival).
     * - 단일(6.0): 내 95 -> 304.00, 상대 80 -> 240.00 => +64.00 (승)
     * - 삼중(5.6, R=11): 둘 다 90 -> 218.67 => 0.00 (무)
     * - 복합(5.6): 내 80 -> 176.00, 상대 90 -> 218.67 => -42.67 (패)
     * - 이중(5.0): +1.00(접전 승) / +1.01(승) / -1.00(접전 패) / -1.01(패)
     * 제외돼야 하는 채보: 레이팅 제외 속성, 기준 난이도 없음, 레이팅 반영 꺼짐, 한쪽만 기록, SRN+ 아닌 기록만 있는 채보
     */
    private void build() {
        singleWin = chart("6.0", PatternType.SINGLE, true);
        record(me, singleWin, "95.00");
        record(rival, singleWin, "80.00");
        SongDifficulty tie = chart("5.6", PatternType.TRIPLE, true);
        record(me, tie, "90.00");
        record(rival, tie, "90.00");
        compoundLoss = chart("5.6", PatternType.COMPOUND, true);
        record(me, compoundLoss, "80.00");
        record(rival, compoundLoss, "90.00");

        both(chart("5.0", PatternType.DOUBLE, true), "80.00", "79.00");   // +1.00
        both(chart("5.0", PatternType.DOUBLE, true), "80.00", "78.99");   // +1.01
        both(chart("5.0", PatternType.DOUBLE, true), "79.00", "80.00");   // -1.00
        both(chart("5.0", PatternType.DOUBLE, true), "78.99", "80.00");   // -1.01

        SongDifficulty excluded = chart("5.6", PatternType.EXCLUDED, true);
        record(me, excluded, "90.00");
        record(rival, excluded, "50.00");
        SongDifficulty noTier = chart(null, PatternType.SINGLE, true);
        record(me, noTier, "90.00");
        record(rival, noTier, "50.00");
        SongDifficulty ratingOff = chart("5.6", PatternType.SINGLE, false);
        record(me, ratingOff, "90.00");
        record(rival, ratingOff, "50.00");
        SongDifficulty onlyMine = chart("5.6", PatternType.TRIPLE, true);
        record(me, onlyMine, "90.00");
        SongDifficulty otherOption = chart("5.6", PatternType.TRIPLE, true);
        record(me, otherOption, "90.00");
        record(rival, otherOption, NoteOption.NORMAL, "99.00");
    }

    private RivalSummaryResponse.PatternSummary pattern(RivalSummaryResponse r, String key) {
        return r.patterns().stream().filter(p -> p.key().equals(key)).findFirst().orElseThrow();
    }

    // ---------- 집계 ----------

    @Test
    void 두_사람이_모두_기록한_레이팅_대상_채보만_속성별로_센다() {
        RivalSummaryResponse r = service.summary(me.getId(), rival.getId());

        assertThat(r.nickname()).isEqualTo("Rumi");
        assertThat(r.totals().sharedCount()).isEqualTo(7);   // 제외 규칙에 걸린 채보·한쪽만·SRN+ 아닌 기록은 없다
        assertThat(pattern(r, "SINGLE").wins()).isEqualTo(1);
        assertThat(pattern(r, "SINGLE").scoreDiffSum()).isEqualByComparingTo("64.00");
        assertThat(pattern(r, "TRIPLE").ties()).isEqualTo(1);
        assertThat(pattern(r, "TRIPLE").closeCount()).isEqualTo(1);
        assertThat(pattern(r, "COMPOUND").losses()).isEqualTo(1);
        assertThat(pattern(r, "COMPOUND").scoreDiffSum()).isEqualByComparingTo("-42.67");
        assertThat(pattern(r, "COMPOSITE_SINGLE").sharedCount()).isZero();
        RivalSummaryResponse.PatternSummary dbl = pattern(r, "DOUBLE");
        assertThat(dbl.sharedCount()).isEqualTo(4);
        assertThat(dbl.wins()).isEqualTo(2);
        assertThat(dbl.losses()).isEqualTo(2);
        assertThat(dbl.closeCount()).isEqualTo(2);           // ±1.00은 접전, ±1.01은 아니다
        assertThat(dbl.scoreDiffSum()).isEqualByComparingTo("0.00");
        assertThat(r.tiers()).extracting(RivalSummaryResponse.TierSummary::tier)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("6.0"), new BigDecimal("5.6"), new BigDecimal("5.0"));
    }

    @Test
    void 방향이_뒤집히면_차이_부호가_뒤집힌다() {
        RivalSummaryResponse r = service.summary(rival.getId(), me.getId());

        assertThat(pattern(r, "SINGLE").losses()).isEqualTo(1);
        assertThat(pattern(r, "SINGLE").scoreDiffSum()).isEqualByComparingTo("-64.00");
        assertThat(pattern(r, "COMPOUND").wins()).isEqualTo(1);
    }

    @Test
    void 표본이_0곡이면_모두_0이다() {
        User stranger = publicUser("sub-stranger", "Stranger");
        em.flush();

        RivalSummaryResponse r = service.summary(me.getId(), stranger.getId());

        assertThat(r.totals().sharedCount()).isZero();
        assertThat(r.patterns()).hasSize(5).allSatisfy(p -> assertThat(p.sharedCount()).isZero());
        assertThat(r.tiers()).isEmpty();
    }

    @Test
    void 제3자의_기록은_두_사람의_집계에_섞이지_않는다() {
        User third = publicUser("sub-third", "Third");
        record(third, singleWin, "99.00");
        record(third, compoundLoss, "99.00");
        em.flush();

        assertThat(service.summary(me.getId(), rival.getId()).totals().sharedCount()).isEqualTo(7);
    }

    // ---------- 접근 ----------

    @Test
    void 비공개_차단_없는_유저_본인은_모두_404다() {
        User hidden = persist(User.create("sub-hidden", "hidden@example.com", "Hidden"));   // 공개하지 않음
        User blocked = publicUser("sub-blocked", "Blocked");
        blocked.block();
        em.flush();

        for (Long target : new Long[]{hidden.getId(), blocked.getId(), 999_999L, me.getId()}) {
            assertThatThrownBy(() -> service.summary(me.getId(), target)).isInstanceOfSatisfying(ApiException.class,
                    e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
            assertThatThrownBy(() -> service.detail(me.getId(), target, "SINGLE", null, null, 0, 20))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        }
    }

    // ---------- 곡 목록 ----------

    @Test
    void 접전_필터는_이중의_1_00_차이_두_곡만_차이_작은_순으로_돌려준다() {
        RivalSummaryDetailResponse r = service.detail(me.getId(), rival.getId(), "DOUBLE", "CLOSE", null, 0, 20);

        assertThat(r.filterCounts().all()).isEqualTo(4);
        assertThat(r.filterCounts().close()).isEqualTo(2);
        assertThat(r.filterCounts().win()).isEqualTo(2);
        assertThat(r.filterCounts().lose()).isEqualTo(2);
        assertThat(r.rows().totalElements()).isEqualTo(2);
        assertThat(r.rows().content()).extracting(RivalSummaryDetailResponse.Row::diff)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactlyInAnyOrder(new BigDecimal("1.00"), new BigDecimal("-1.00"));
        assertThat(r.rows().content()).allSatisfy(row -> {
            assertThat(row.pattern()).isEqualTo("이중");
            assertThat(row.tier()).isEqualByComparingTo("5.0");
        });
    }

    @Test
    void 열세_필터는_많이_뒤진_곡부터_줄에_양쪽_기록을_담는다() {
        RivalSummaryDetailResponse r = service.detail(me.getId(), rival.getId(), "COMPOUND", "LOSE", null, 0, 20);

        assertThat(r.rows().content()).hasSize(1);
        RivalSummaryDetailResponse.Row row = r.rows().content().get(0);
        assertThat(row.songDifficultyId()).isEqualTo(compoundLoss.getId());
        assertThat(row.title()).isEqualTo(compoundLoss.getSong().getTitle());
        assertThat(row.score()).isEqualByComparingTo("218.67");
        assertThat(row.myScore()).isEqualByComparingTo("176.00");
        assertThat(row.diff()).isEqualByComparingTo("-42.67");
        assertThat(row.rate()).isEqualByComparingTo("90.00");
        assertThat(row.myRate()).isEqualByComparingTo("80.00");
        assertThat(row.stage()).isNotNull();
        assertThat(row.myStage()).isNotNull();
    }

    @Test
    void 정렬과_페이지는_화이트리스트와_상한을_지킨다() {
        RivalSummaryDetailResponse byDiff = service.detail(me.getId(), rival.getId(), "DOUBLE", "ALL", "DIFF_DESC", 0, 3);
        assertThat(byDiff.rows().content()).extracting(RivalSummaryDetailResponse.Row::diff)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("1.01"), new BigDecimal("1.00"), new BigDecimal("-1.00"));
        assertThat(byDiff.rows().totalPages()).isEqualTo(2);
        assertThat(service.detail(me.getId(), rival.getId(), "DOUBLE", "ALL", "DIFF_DESC", 1, 3).rows().content()).hasSize(1);
        assertThat(service.detail(me.getId(), rival.getId(), "DOUBLE", null, null, 0, 10_000).rows().size()).isEqualTo(50);

        assertThatThrownBy(() -> service.detail(me.getId(), rival.getId(), "DOUBLE", "ALL", "TITLE; DROP TABLE users", 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
        assertThatThrownBy(() -> service.detail(me.getId(), rival.getId(), "EXCLUDED", null, null, 0, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.BAD_REQUEST));
    }

    @Test
    void 공유_곡이_없는_속성은_빈_목록이다() {
        RivalSummaryDetailResponse r = service.detail(me.getId(), rival.getId(), "COMPOSITE_SINGLE", null, null, 0, 20);

        assertThat(r.summary().sharedCount()).isZero();
        assertThat(r.rows().content()).isEmpty();
        assertThat(r.rows().totalElements()).isZero();
    }
}
