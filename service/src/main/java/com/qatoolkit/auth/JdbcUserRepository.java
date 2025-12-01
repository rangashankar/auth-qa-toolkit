package com.qatoolkit.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;

public class JdbcUserRepository implements UserRepository {
    private final JdbcTemplate jdbcTemplate;

    public JdbcUserRepository(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(Objects.requireNonNull(dataSource, "dataSource"));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        String sql = "select email, password_hash, locked from users where email = ?";
        return jdbcTemplate.query(sql, new UserRowMapper(), email).stream().findFirst();
    }

    @Override
    public void save(User user) {
        String sql = "insert into users(email, password_hash, locked) values (?, ?, ?)";
        jdbcTemplate.update(sql, user.getEmail(), user.getPasswordHash(), user.isLocked());
    }

    private static class UserRowMapper implements RowMapper<User> {
        @Override
        public User mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new User(
                    rs.getString("email"),
                    rs.getString("password_hash"),
                    rs.getBoolean("locked"));
        }
    }
}
