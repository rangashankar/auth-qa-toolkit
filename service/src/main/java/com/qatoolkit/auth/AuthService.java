package com.qatoolkit.auth;

import java.util.Objects;

public class AuthService {
    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public AuthService(UserRepository userRepository, PasswordHasher passwordHasher) {
        this.userRepository = Objects.requireNonNull(userRepository, "userRepository");
        this.passwordHasher = Objects.requireNonNull(passwordHasher, "passwordHasher");
    }

    public AuthResult authenticate(String email, String password) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    if (user.isLocked()) {
                        return AuthResult.locked(user);
                    }
                    boolean match = passwordHasher.matches(password, user.getPasswordHash());
                    return match ? AuthResult.success(user) : AuthResult.invalid();
                })
                .orElse(AuthResult.invalid());
    }
}
