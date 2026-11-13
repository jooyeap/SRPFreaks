package com.srpfreaks.backend.dto;

import com.srpfreaks.backend.entity.UserList;

/**
 * 내 리스트 한 줄(목록용). itemCount는 삭제된 곡·채보를 뺀 곡 수.
 * contains는 목록을 songDifficultyId로 조회했을 때만 채워진다(그 채보가 이 리스트에 담겨 있는지, 곡 상세의 담기 시트용). 아니면 null.
 */
public record UserListSummaryResponse(Long id, String name, long itemCount, Boolean contains) {

    public static UserListSummaryResponse of(UserList list, long itemCount, Boolean contains) {
        return new UserListSummaryResponse(list.getId(), list.getName(), itemCount, contains);
    }
}
