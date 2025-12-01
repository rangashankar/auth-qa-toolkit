package com.qatoolkit.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordHasher passwordHasher;

    @InjectMocks
    private AuthService authService;

    private final User unlockedUser = new User("qa@example.com", "hashed", false);
    private final User lockedUser = new User("locked@example.com", "hashed", true);

    @BeforeEach
    void setup() {
        when(passwordHasher.matches("secret", "hashed")).thenReturn(true);
        when(passwordHasher.matches("wrong", "hashed")).thenReturn(false);
    }

    @Test
    void authenticatesWhenPasswordMatches() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(unlockedUser));

        AuthResult result = authService.authenticate("qa@example.com", "secret");

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getUser()).isEqualTo(unlockedUser);
    }

    @Test
    void rejectsWhenPasswordInvalid() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(unlockedUser));

        AuthResult result = authService.authenticate("qa@example.com", "wrong");

        assertThat(result.getStatus()).isEqualTo(AuthResult.Status.INVALID);
    }

    @Test
    void rejectsLockedAccountsEarly() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.of(lockedUser));

        AuthResult result = authService.authenticate("locked@example.com", "secret");

        assertThat(result.getStatus()).isEqualTo(AuthResult.Status.LOCKED);
    }

    @Test
    void rejectsUnknownUser() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        AuthResult result = authService.authenticate("missing@example.com", "secret");

        assertThat(result.getStatus()).isEqualTo(AuthResult.Status.INVALID);
    }
}
