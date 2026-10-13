CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    eagate_session VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE songs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255)
);

CREATE TABLE song_difficulties (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id BIGINT NOT NULL,
    difficulty_type VARCHAR(20) NOT NULL, -- BASIC, ADVANCED, EXTREME, MASTER
    level DECIMAL(3,2) NOT NULL,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE KEY uk_song_difficulty (song_id, difficulty_type)
);

CREATE TABLE play_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    difficulty_id BIGINT NOT NULL,
    achievement_rate DECIMAL(5,2) NOT NULL,
    skill_point DECIMAL(6,2),
    clear_rank VARCHAR(10),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (difficulty_id) REFERENCES song_difficulties(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_difficulty (user_id, difficulty_id) -- 유저당 곡+난이도별 최고기록 1개
);

CREATE TABLE manual_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    difficulty_id BIGINT NOT NULL,
    option_type VARCHAR(20) NOT NULL, -- RANDOM, SUPER_RANDOM, RANDOM_PLUS, SUPER_RANDOM_PLUS
    achievement_rate DECIMAL(5,2) NOT NULL,
    skill_point DECIMAL(6,2),
    memo VARCHAR(255),
    evidence_image_url VARCHAR(500),
    ocr_extracted_json TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (difficulty_id) REFERENCES song_difficulties(id) ON DELETE CASCADE,
    INDEX idx_ranking (option_type, achievement_rate DESC) -- 랭킹 조회용
);