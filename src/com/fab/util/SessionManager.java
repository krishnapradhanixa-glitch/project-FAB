package com.fab.util;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory session manager.
 * Demonstrates Java: Collections, encapsulation, thread safety.
 */
public class SessionManager {
    // token -> userId
    private static final Map<String, Integer> sessions =
            Collections.synchronizedMap(new ConcurrentHashMap<>());

    public static String createSession(int userId) {
        String token = UUID.randomUUID().toString();
        sessions.put(token, userId);
        return token;
    }

    public static Integer getUserId(String token) {
        if (token == null || token.isBlank()) return null;
        return sessions.get(token);
    }

    public static boolean isValid(String token) {
        return token != null && sessions.containsKey(token);
    }

    public static void invalidate(String token) {
        if (token != null) sessions.remove(token);
    }

    /** Extract token from X-Session-Token header or ?token= query param */
    public static String extractToken(com.sun.net.httpserver.HttpExchange ex) {
        String header = ex.getRequestHeaders().getFirst("X-Session-Token");
        if (header != null && !header.isBlank()) return header;
        String query = ex.getRequestURI().getQuery();
        if (query != null) {
            for (String part : query.split("&")) {
                if (part.startsWith("token=")) return part.substring(6);
            }
        }
        return null;
    }
}
