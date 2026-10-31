package com.srpfreaks.backend.service;

import com.srpfreaks.backend.dto.SongJacketsResponse;
import com.srpfreaks.backend.entity.AppSetting;
import com.srpfreaks.backend.repository.AppSettingRepository;
import com.srpfreaks.backend.repository.SongRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SongJacketQueryServiceTest {

    @Mock AppSettingRepository appSettingRepository;
    @Mock SongRepository songRepository;
    @InjectMocks SongJacketQueryService service;

    @Test
    void 운영_설정이_꺼져_있으면_주소를_내보내지_않는다() {
        when(appSettingRepository.findById("ui.show_song_images")).thenReturn(Optional.of(AppSetting.create("ui.show_song_images", "false", null)));
        SongJacketsResponse res = service.jackets();
        assertThat(res.enabled()).isFalse();
        assertThat(res.jackets()).isEmpty();
        verify(songRepository, never()).findAllJacketUrls();
    }

    @Test
    void 설정이_없어도_꺼진_것으로_본다() {
        when(appSettingRepository.findById("ui.show_song_images")).thenReturn(Optional.empty());
        assertThat(service.jackets().enabled()).isFalse();
    }

    @Test
    void 켜져_있으면_곡_id별_재킷_주소를_준다() {
        when(appSettingRepository.findById("ui.show_song_images")).thenReturn(Optional.of(AppSetting.create("ui.show_song_images", "true", null)));
        when(songRepository.findAllJacketUrls()).thenReturn(List.of(new SongRepository.SongText(3L, "/jackets/3.webp?v=abcd1234")));
        SongJacketsResponse res = service.jackets();
        assertThat(res.enabled()).isTrue();
        assertThat(res.jackets()).containsEntry(3L, "/jackets/3.webp?v=abcd1234");
    }
}
