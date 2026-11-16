package com.fab.dao;

import com.fab.model.User;
import com.fab.util.DBUtil;
import java.sql.*;
import java.time.LocalDateTime;

/**
 * Data Access Object for Users.
 * Demonstrates DBMS: parameterized queries, INSERT, SELECT, referential integrity.
 * Demonstrates Java: JDBC, exception handling, encapsulation.
 */
public class UserDAO {

    /** Register a new user. Returns generated UserID or -1 on failure. */
    public int register(String fullName, String email, String passwordHash) throws SQLException {
        String sql = "INSERT INTO Users (FullName, Email, PasswordHash) VALUES (?, ?, ?)";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, fullName);
            ps.setString(2, email);
            ps.setString(3, passwordHash);
            ps.executeUpdate();
            ResultSet rs = ps.getGeneratedKeys();
            if (rs.next()) return rs.getInt(1);
            return -1;
        }
    }

    /** Find user by email for login. Returns null if not found. */
    public User findByEmail(String email) throws SQLException {
        String sql = "SELECT UserID, FullName, Email, PasswordHash, CreatedAt FROM Users WHERE Email = ?";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                User u = new User();
                u.setUserId(rs.getInt("UserID"));
                u.setFullName(rs.getString("FullName"));
                u.setEmail(rs.getString("Email"));
                u.setPasswordHash(rs.getString("PasswordHash"));
                Timestamp ts = rs.getTimestamp("CreatedAt");
                if (ts != null) u.setCreatedAt(ts.toLocalDateTime());
                return u;
            }
            return null;
        }
    }

    /** Check if an email is already registered. */
    public boolean emailExists(String email) throws SQLException {
        String sql = "SELECT COUNT(*) FROM Users WHERE Email = ?";
        try (Connection conn = DBUtil.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }
}
