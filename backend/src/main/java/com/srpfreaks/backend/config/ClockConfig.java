package com.srpfreaks.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** 시간을 직접 부르지 않고 Clock을 주입받는다. 테스트에서 고정 시각으로 바꿔 만료 로직을 검사하기 위해서다. */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
