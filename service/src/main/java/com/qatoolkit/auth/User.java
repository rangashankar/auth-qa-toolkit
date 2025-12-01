package com.qatoolkit.auth;

import java.util.Objects;

public class User {
    private final String email;
    private final String passwordHash;
    private final boolean locked;

    public User(String email, String passwordHash, boolean locked) {
        this.email = Objects.requireNonNull(email, "email");
        this.passwordHash = Objects.requireNonNull(passwordHash, "passwordHash");
        this.locked = locked;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public boolean isLocked() {
        return locked;
    }
}
