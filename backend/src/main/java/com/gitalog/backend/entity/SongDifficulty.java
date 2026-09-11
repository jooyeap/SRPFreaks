package com.gitalog.backend.entity;

import java.math.BigDecimal;

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
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
	name = "song_difficulties",
	uniqueConstraints = @UniqueConstraint(
		name = "uk_song_part_difficulty",
		columnNames = {"song_id", "instrument_part", "difficulty_type"}
	)
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SongDifficulty {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "song_id", nullable = false)
	private Song song;
	
	@Enumerated(EnumType.STRING)
	@Column(name = "instrument_part", nullable = false, length = 10)
	private InstrumentPart instrumentPart;
	
	@Enumerated(EnumType.STRING)
	@Column(name = "difficulty_type", nullable = false, length = 20)
	private DifficultyType difficultyType;
	
	@Column(nullable = false, precision = 3, scale = 2)
	private BigDecimal level;
}
