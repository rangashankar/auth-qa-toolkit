package com.qatoolkit.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestInstance.Lifecycle;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@TestInstance(Lifecycle.PER_CLASS)
class JdbcUserRepositoryIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("users")
            .withUsername("test")
            .withPassword("test");

    private JdbcUserRepository userRepository;
    private AuthService authService;
    private PasswordHasher passwordHasher;
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        DataSource dataSource = buildDataSource();
        jdbcTemplate = new JdbcTemplate(dataSource);
        userRepository = new JdbcUserRepository(dataSource);
        passwordHasher = new Sha256PasswordHasher();
        authService = new AuthService(userRepository, passwordHasher);
        initializeSchema();
    }

    @Test
    void roundTripUserWithHashedPassword() {
        String email = "integration@example.com";
        String hashed = passwordHasher.hash("Secret123!");
        userRepository.save(new User(email, hashed, false));

        User stored = userRepository.findByEmail(email).orElseThrow();
        assertThat(stored.getEmail()).isEqualTo(email);
        assertThat(stored.getPasswordHash()).isEqualTo(hashed);
        assertThat(stored.isLocked()).isFalse();
    }

    @Test
    void authenticatesAgainstRealDatabase() {
        String email = "fullpath@example.com";
        String rawPassword = "MyPassw0rd";
        userRepository.save(new User(email, passwordHasher.hash(rawPassword), false));

        AuthResult success = authService.authenticate(email, rawPassword);
        AuthResult failure = authService.authenticate(email, "bad-password");

        assertThat(success.isSuccess()).isTrue();
        assertThat(failure.getStatus()).isEqualTo(AuthResult.Status.INVALID);
    }

    private DataSource buildDataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(postgres.getJdbcUrl());
        dataSource.setUsername(postgres.getUsername());
        dataSource.setPassword(postgres.getPassword());
        return dataSource;
    }

    private void initializeSchema() {
        jdbcTemplate.execute("drop table if exists users");
        jdbcTemplate.execute("create table users (" +
                "email varchar(255) primary key," +
                "password_hash varchar(255) not null," +
                "locked boolean not null" +
                ")");
    }
}
