package com.qatoolkit.auth;

public class AuthResult {
    public enum Status { SUCCESS, LOCKED, INVALID }

    private final Status status;
    private final User user;

    private AuthResult(Status status, User user) {
        this.status = status;
        this.user = user;
    }

    public static AuthResult success(User user) {
        return new AuthResult(Status.SUCCESS, user);
    }

    public static AuthResult locked(User user) {
        return new AuthResult(Status.LOCKED, user);
    }

    public static AuthResult invalid() {
        return new AuthResult(Status.INVALID, null);
    }

    public Status getStatus() {
        return status;
    }

    public User getUser() {
        return user;
    }

    public boolean isSuccess() {
        return status == Status.SUCCESS;
    }
}
