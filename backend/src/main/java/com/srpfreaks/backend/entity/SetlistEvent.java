package com.srpfreaks.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 세트리스트 담기/빼기 이력 한 줄 (D52). 집계(추천)용 데이터이고 화면·API로 내보내지 않는다. 만든 뒤 바꾸지 않는다(setter 없음).
 * 쓰기는 SetlistEventRepository.insertIfAbsent(하루 한 줄을 DB가 보장)로만 하므로 이 엔티티를 직접 save하지 않는다. 읽기·테스트용 매핑이다.
 */
@Getter
@Entity
@Table(name = "setlist_events")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SetlistEvent extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "setlist_event_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_difficulty_id", nullable = false)
    private SongDifficulty songDifficulty;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "event_type", nullable = false, length = 10)
    private SetlistEventType eventType;

    /** Asia/Seoul 날짜. (사용자, 채보, 종류, 날짜)가 유일하다. */
    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    /** 그때 사용자의 평균 난이도. 평균을 구할 수 없었으면(신규·기록 부족) null. */
    @Column(name = "average_level", precision = 5, scale = 2)
    private BigDecimal averageLevel;
}
