package com.gitalog.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "manual_records",
    indexes = @Index(name = "idx_ranking", columnList = "option_type, achievement_rate DESC")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManualRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "difficulty_id", nullable = false)
    private SongDifficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(name = "option_type", nullable = false, length = 20)
    private OptionType optionType;

    @Column(name = "achievement_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal achievementRate;

    @Column(name = "skill_point", precision = 6, scale = 2)
    private BigDecimal skillPoint;

    @Column(length = 255)
    private String memo;

    @Column(name = "evidence_image_url", length = 500)
    private String evidenceImageUrl;

    @Lob
    @Column(name = "ocr_extracted_json", columnDefinition = "TEXT")
    private String ocrExtractedJson;

    @CreationTimestamp
    @Column(name = "recorded_at", updatable = false)
    private LocalDateTime recordedAt;
}