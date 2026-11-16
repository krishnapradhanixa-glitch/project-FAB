package com.fab.server;

import com.fab.dao.UserDAO;
import com.fab.util.HttpUtil;
import com.fab.util.PasswordUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Handles /api/auth/* endpoints: register, login, logout, me.
 * Demonstrates Java: OOP, exception handling, encapsulation.
 * Demonstrates SE: authentication, input validation, security.
 */
public class AuthHandler implements HttpHandler {
    private final UserDAO userDAO = new UserDAO();
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    @Override
    public void handle(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        String path   = ex.getRequestURI().getPath();

        if ("OPTIONS".equals(method)) { HttpUtil.sendOptions(ex); return; }

        try {
            if (path.endsWith("/register") && "POST".equals(method)) handleRegister(ex);
            else if (path.endsWith("/login")    && "POST".equals(method)) handleLogin(ex);
            else if (path.endsWith("/logout")   && "POST".equals(method)) handleLogout(ex);
            else if (path.endsWith("/me")       && "GET".equals(method))  handleMe(ex);
            else HttpUtil.sendJson(ex, 404, "{\"error\":\"Not found\"}");
        } catch (Exception e) {
            System.err.println("[AuthHandler] " + e.getMessage());
            HttpUtil.sendJson(ex, 500, "{\"error\":\"Internal server error\"}");
        }
    }

    private void handleRegister(HttpExchange ex) throws IOException, SQLException {
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        String fullName = body.getOrDefault("fullName","").trim();
        String email    = body.getOrDefault("email","").trim().toLowerCase();
        String password = body.getOrDefault("password","");
        String confirm  = body.getOrDefault("confirmPassword","");

        // Validation
        if (fullName.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Full name is required\"}"); return; }
        if (!EMAIL_PATTERN.matcher(email).matches()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Invalid email format\"}"); return; }
        if (password.length() < 8) { HttpUtil.sendJson(ex,400,"{\"error\":\"Password must be at least 8 characters\"}"); return; }
        if (!password.matches(".*[A-Z].*")) { HttpUtil.sendJson(ex,400,"{\"error\":\"Password must contain at least one uppercase letter\"}"); return; }
        if (!password.matches(".*[0-9].*")) { HttpUtil.sendJson(ex,400,"{\"error\":\"Password must contain at least one digit\"}"); return; }
        if (!password.equals(confirm)) { HttpUtil.sendJson(ex,400,"{\"error\":\"Passwords do not match\"}"); return; }
        if (userDAO.emailExists(email)) { HttpUtil.sendJson(ex,409,"{\"error\":\"Email already registered\"}"); return; }

        String hash = PasswordUtil.hash(password);
        int id = userDAO.register(fullName, email, hash);
        HttpUtil.sendJson(ex, 201, "{\"message\":\"Account created successfully\",\"userId\":" + id + "}");
    }

    private void handleLogin(HttpExchange ex) throws IOException, SQLException {
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        String email    = body.getOrDefault("email","").trim().toLowerCase();
        String password = body.getOrDefault("password","");

        if (email.isEmpty() || password.isEmpty()) {
            HttpUtil.sendJson(ex, 400, "{\"error\":\"Email and password are required\"}"); return;
        }
        var user = userDAO.findByEmail(email);
        if (user == null || !PasswordUtil.verify(password, user.getPasswordHash())) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Invalid email or password\"}"); return;
        }
        String token = SessionManager.createSession(user.getUserId());
        HttpUtil.sendJson(ex, 200, "{\"token\":\"" + token + "\",\"fullName\":\"" +
            HttpUtil.esc(user.getFullName()) + "\",\"email\":\"" + HttpUtil.esc(user.getEmail()) + "\"}");
    }

    private void handleLogout(HttpExchange ex) throws IOException {
        String token = SessionManager.extractToken(ex);
        SessionManager.invalidate(token);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Logged out successfully\"}");
    }

    private void handleMe(HttpExchange ex) throws IOException, SQLException {
        String token = SessionManager.extractToken(ex);
        if (!SessionManager.isValid(token)) { HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return; }
        Integer uid = SessionManager.getUserId(token);
        // Return basic user info without hitting DB again (uid is enough for client)
        HttpUtil.sendJson(ex, 200, "{\"userId\":" + uid + ",\"authenticated\":true}");
    }
}
