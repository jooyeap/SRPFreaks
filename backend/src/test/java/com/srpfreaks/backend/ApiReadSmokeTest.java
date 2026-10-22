package com.srpfreaks.backend;

import com.srpfreaks.backend.entity.DifficultyTable;
import com.srpfreaks.backend.entity.DifficultyTableEntry;
import com.srpfreaks.backend.entity.DifficultyType;
import com.srpfreaks.backend.entity.InstrumentPart;
import com.srpfreaks.backend.entity.NoteOption;
import com.srpfreaks.backend.entity.OptionRecord;
import com.srpfreaks.backend.entity.PatternType;
import com.srpfreaks.backend.entity.SetlistItem;
import com.srpfreaks.backend.entity.Song;
import com.srpfreaks.backend.entity.SongDifficulty;
import com.srpfreaks.backend.entity.User;
import com.srpfreaks.backend.security.JwtTokenProvider;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 로그인한 사용자가 쓰는 조회 API를 실제 서버(임의 포트) + 실제 MySQL로 한 번씩 호출해 본다.
 *
 * 왜 필요한가: 서비스·쿼리 테스트는 @DataJpaTest(테스트 전체가 하나의 트랜잭션)라서, 지연 로딩(LAZY) 연관을
 * 트랜잭션 밖에서 건드리는 실수가 있어도 통과해 버린다. 여기서는 데이터를 먼저 커밋해 두고 실제 HTTP로 호출하므로
 * 요청 처리 중에 지연 로딩이 깨지면(예: open-in-view를 끈 뒤의 LazyInitializationException) 500이 나서 테스트가 실패한다.
 *
 * 확인하는 것은 "200으로 응답하고 핵심 값이 들어 있다"까지다. 계산 규칙·정렬 같은 세부는 각 서비스 테스트가 본다.
 * Docker가 필요하다. 비밀값은 다른 통합 테스트와 같은 테스트용 더미 값이다.
 */
@SpringBootTest(
		webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = {
				"spring.datasource.password=unused",
				"jwt.secret=test-only-secret-key-at-least-32-bytes-long",
				"app.google.client-id=test-client-id.apps.googleusercontent.com"
		})
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiReadSmokeTest {

	@Container
	@ServiceConnection
	static MySQLContainer mysql = new MySQLContainer("mysql:8.4");

	@Value("${local.server.port}")
	int port;

	@Autowired PlatformTransactionManager transactionManager;
	@Autowired JwtTokenProvider jwtTokenProvider;
	@PersistenceContext EntityManager em;

	Long userId;
	Long otherUserId;
	Long tableId;
	Long songId;
	String token;

	/** 데이터를 커밋해 둔다(트랜잭션 밖에서 읽는 요청이 이 데이터를 본다). 컨테이너는 클래스가 끝나면 사라지므로 지우지 않는다. */
	@BeforeAll
	void seed() {
		new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
			User me = User.create("sub-smoke-me", "smoke-me@example.com", "Tester");
			me.changeProfilePublic(true);
			User other = User.create("sub-smoke-other", "smoke-other@example.com", "Other");
			other.changeProfilePublic(true);
			em.persist(me);
			em.persist(other);

			DifficultyTable table = DifficultyTable.create("SRN+ 서열표", null, NoteOption.SUPER_RANDOM_PLUS);
			em.persist(table);

			PatternType[] patterns = {PatternType.SINGLE, PatternType.COMPOUND, PatternType.SINGLE, PatternType.COMPOUND};
			String[] tiers = {"6.0", "6.2", "5.8", "7.0"};
			String[] rates = {"96.50", "88.20", "100.00", "72.10"};
			Long firstSongId = null;
			SongDifficulty firstChart = null;
			for (int i = 0; i < 4; i++) {
				Song song = Song.create("스모크 곡" + i, "아티스트", "test", me);
				em.persist(song);
				SongDifficulty chart = SongDifficulty.create(song, InstrumentPart.GUITAR, DifficultyType.MASTER,
						new BigDecimal("9." + (50 + i)));
				em.persist(chart);

				DifficultyTableEntry entry = DifficultyTableEntry.create(table, chart);
				entry.changeTier(new BigDecimal(tiers[i]), false, null);
				entry.changePattern(patterns[i], false);
				entry.changeRatingEnabled(true);
				em.persist(entry);

				em.persist(OptionRecord.create(me, chart, NoteOption.SUPER_RANDOM_PLUS, new BigDecimal(rates[i]),
						i == 2, null, null, null));
				if (i == 0) {
					firstSongId = song.getId();
					firstChart = chart;
				}
			}
			em.persist(SetlistItem.create(me, firstChart));
			em.flush();

			userId = me.getId();
			otherUserId = other.getId();
			tableId = table.getId();
			songId = firstSongId;
		});
		token = jwtTokenProvider.generateAccessToken(userId);
	}

	private HttpResponse<String> get(String path) throws Exception {
		HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
				.header("Authorization", "Bearer " + token)
				.GET()
				.build();
		return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
	}

	/** 200이어야 한다. 아니면 상태와 본문을 메시지에 담아 원인을 바로 볼 수 있게 한다. */
	private String ok(String path) throws Exception {
		HttpResponse<String> response = get(path);
		assertThat(response.statusCode()).as("%s -> %s", path, response.body()).isEqualTo(200);
		return response.body();
	}

	@Test
	void 내_정보() throws Exception {
		assertThat(ok("/api/v1/users/me")).contains("\"nickname\":\"Tester\"");
	}

	@Test
	void 곡_목록_폴더와_채보_목록() throws Exception {
		assertThat(ok("/api/v1/songs/chart-folders")).contains("\"totalCharts\":4");
		// 9.50 ~ 9.99 폴더의 채보(곡 정보를 지연 로딩하는 경로)
		assertThat(ok("/api/v1/songs/charts?folder=9.50")).contains("스모크 곡0");
		assertThat(ok("/api/v1/songs?q=" + java.net.URLEncoder.encode("스모크", java.nio.charset.StandardCharsets.UTF_8)))
				.contains("스모크 곡1");
	}

	@Test
	void 곡_상세() throws Exception {
		assertThat(ok("/api/v1/songs/" + songId)).contains("스모크 곡0");
	}

	@Test
	void 서열표와_내_기록() throws Exception {
		assertThat(ok("/api/v1/difficulty-tables")).contains("SRN+ 서열표");
		String body = ok("/api/v1/difficulty-tables/" + tableId + "/entries?mine=true");
		assertThat(body).contains("스모크 곡0").contains("\"stage\":\"SS\"");
	}

	@Test
	void 내_레이팅과_스냅샷_상태() throws Exception {
		String skill = ok("/api/v1/skills/me");
		assertThat(skill).contains("스모크 곡2").contains("\"tier\"");
		ok("/api/v1/skills/me/snapshots");
		ok("/api/v1/skills/me/snapshots/status");
	}

	@Test
	void 유저_목록과_유저_상세() throws Exception {
		assertThat(ok("/api/v1/players")).contains("Tester").contains("Other");
		assertThat(ok("/api/v1/players/" + userId)).contains("스모크 곡0");
		assertThat(ok("/api/v1/players/" + otherUserId)).contains("Other");
	}

	@Test
	void 기록_목록() throws Exception {
		assertThat(ok("/api/v1/records")).contains("스모크 곡0");
	}

	@Test
	void 세트리스트와_추천() throws Exception {
		assertThat(ok("/api/v1/setlist")).contains("스모크 곡0");
		ok("/api/v1/setlist/recommendations");
	}

	@Test
	void 통계() throws Exception {
		ok("/api/v1/stats/level-rate-folders");
		ok("/api/v1/stats/tier-rate-folders");
	}

	@Test
	void 공지와_내_건의() throws Exception {
		ok("/api/v1/notices");
		ok("/api/v1/suggestions/me");
	}
}
