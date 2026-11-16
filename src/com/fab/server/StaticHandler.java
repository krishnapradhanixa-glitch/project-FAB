package com.fab.server;

import com.fab.util.HttpUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.*;
import java.nio.file.*;
import java.util.Map;

/**
 * Serves static files (HTML, CSS, JS, images) from the web/ directory.
 */
public class StaticHandler implements HttpHandler {
    private static final String WEB_ROOT = "D:/project-fab/web";

    private static final Map<String, String> MIME = Map.of(
        "html", "text/html; charset=UTF-8",
        "css",  "text/css",
        "js",   "application/javascript",
        "png",  "image/png",
        "jpg",  "image/jpeg",
        "ico",  "image/x-icon",
        "json", "application/json",
        "svg",  "image/svg+xml"
    );

    @Override
    public void handle(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        if ("OPTIONS".equals(method)) { HttpUtil.sendOptions(ex); return; }

        String uriPath = ex.getRequestURI().getPath();
        // Default to index.html
        if ("/".equals(uriPath) || uriPath.isEmpty()) uriPath = "/index.html";

        // Security: prevent path traversal
        if (uriPath.contains("..")) {
            HttpUtil.sendJson(ex, 403, "{\"error\":\"Forbidden\"}"); return;
        }

        File file = new File(WEB_ROOT + uriPath);
        if (!file.exists() || file.isDirectory()) {
            // SPA fallback: serve index.html for unknown paths
            file = new File(WEB_ROOT + "/index.html");
        }

        if (!file.exists()) {
            HttpUtil.sendJson(ex, 404, "{\"error\":\"Not found\"}"); return;
        }

        byte[] bytes = Files.readAllBytes(file.toPath());
        String ext = getExtension(file.getName());
        String mime = MIME.getOrDefault(ext, "application/octet-stream");
        HttpUtil.sendFile(ex, 200, bytes, mime);
    }

    private String getExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
    }
}
