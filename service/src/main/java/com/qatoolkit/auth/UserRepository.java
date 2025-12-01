package com.qatoolkit.auth;

import java.util.Optional;

public interface UserRepository {
    Optional<User> findByEmail(String email);

    void save(User user);
}
