package com.srpfreaks.backend.entity;

/** 권한. ROOT > ADMIN > USER (RoleHierarchy로 상위가 하위 권한을 포함한다). */
public enum Role {
    ROOT, ADMIN, USER
}
