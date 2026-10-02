package com.srpfreaks.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.srpfreaks.backend.entity.User;

public interface UserRepository extends JpaRepository<User, Long>{
	
	public Optional<User> findByUsername(String username);
	
	public boolean existsByUsername(String username);
}
