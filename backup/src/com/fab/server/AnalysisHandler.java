package com.fab.server;

import com.fab.util.HttpUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.*;
import java.nio.file.*;
import java.util.Map;

/**
 * Runs Python analysis script and returns results + chart paths.
 */
public class AnalysisHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { HttpUtil.sendOptions(ex); return; }
        if (!SessionManager.isValid(SessionManager.extractToken(ex))) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return;
        }
        try {
            // Find Python executable
            String pythonExe = findPython();
            String scriptPath = "python/analyze.py";
            File script = new File(scriptPath);
            if (!script.exists()) script = new File("D:/project-fab/python/analyze.py");

            ProcessBuilder pb = new ProcessBuilder(pythonExe, script.getAbsolutePath());
            pb.directory(new File("D:/project-fab"));
            pb.redirectErrorStream(true);
            Process process = pb.start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                String errJson = "{\"error\":\"Python analysis failed\",\"details\":\"" +
                    HttpUtil.esc(output.length() > 500 ? output.substring(0, 500) : output) + "\"}";
                HttpUtil.sendJson(ex, 500, errJson);
                return;
            }

            // Read the JSON results file written by Python
            Path resultsFile = Path.of("D:/project-fab/python/analysis_results.json");
            if (!Files.exists(resultsFile)) {
                HttpUtil.sendJson(ex, 500, "{\"error\":\"Analysis results not found\",\"output\":\"" + HttpUtil.esc(output) + "\"}");
                return;
            }
            String results = Files.readString(resultsFile);
            HttpUtil.sendJson(ex, 200, results);

        } catch (Exception e) {
            System.err.println("[AnalysisHandler] " + e);
            HttpUtil.sendJson(ex, 500, "{\"error\":\"" + HttpUtil.esc(e.getMessage()) + "\"}");
        }
    }

    private String findPython() {
        String[] candidates = {
            "C:/Users/Dell/AppData/Local/Programs/Python/Python312/python.exe",
            "python3", "python"
        };
        for (String c : candidates) {
            File f = new File(c);
            if (f.exists()) return f.getAbsolutePath();
        }
        return "python";
    }
}
