package com.fab.server;

import com.fab.dao.ReportDAO;
import com.fab.util.HttpUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/** Handles /api/reports/* — area, vehicle, completion, datewise */
public class ReportHandler implements HttpHandler {
    private final ReportDAO dao = new ReportDAO();

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { HttpUtil.sendOptions(ex); return; }
        if (!SessionManager.isValid(SessionManager.extractToken(ex))) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return;
        }
        String path = ex.getRequestURI().getPath();
        Map<String, String> params = HttpUtil.parseQuery(ex.getRequestURI().getQuery());
        try {
            if (path.endsWith("/area"))       handleAreaReport(ex);
            else if (path.endsWith("/vehicle")) handleVehicleReport(ex);
            else if (path.endsWith("/completion")) handleCompletionReport(ex, params);
            else if (path.endsWith("/datewise"))   handleDateWiseReport(ex, params);
            else HttpUtil.sendJson(ex, 404, "{\"error\":\"Report not found\"}");
        } catch (Exception e) {
            System.err.println("[ReportHandler] " + e.getMessage());
            HttpUtil.sendJson(ex, 500, "{\"error\":\"" + HttpUtil.esc(e.getMessage()) + "\"}");
        }
    }

    private void handleAreaReport(HttpExchange ex) throws IOException, SQLException {
        List<Map<String, Object>> rows = dao.getAreaWiseReport();
        HttpUtil.sendJson(ex, 200, listOfMapsToJson(rows));
    }

    private void handleVehicleReport(HttpExchange ex) throws IOException, SQLException {
        List<Map<String, Object>> rows = dao.getVehicleUtilizationReport();
        HttpUtil.sendJson(ex, 200, listOfMapsToJson(rows));
    }

    private void handleCompletionReport(HttpExchange ex, Map<String, String> params) throws IOException, SQLException {
        List<Map<String, Object>> rows = dao.getCompletionReport(
            params.get("area"), params.get("vehicle"), params.get("dateFrom"), params.get("dateTo"));
        Map<String, Object> summary = dao.getCompletionSummary(
            params.get("area"), params.get("vehicle"), params.get("dateFrom"), params.get("dateTo"));
        String json = "{\"records\":" + listOfMapsToJson(rows) + ",\"summary\":" + mapToJson(summary) + "}";
        HttpUtil.sendJson(ex, 200, json);
    }

    private void handleDateWiseReport(HttpExchange ex, Map<String, String> params) throws IOException, SQLException {
        List<Map<String, Object>> rows = dao.getDateWiseReport(
            params.get("period"), params.get("dateFrom"), params.get("dateTo"));
        HttpUtil.sendJson(ex, 200, listOfMapsToJson(rows));
    }

    static String mapToJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> e : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(HttpUtil.esc(e.getKey())).append("\":");
            Object v = e.getValue();
            if (v instanceof String) sb.append("\"").append(HttpUtil.esc((String) v)).append("\"");
            else if (v instanceof Map) sb.append(mapToJson((Map<String, Object>) v));
            else sb.append(v);
        }
        return sb.append("}").toString();
    }

    static String listOfMapsToJson(List<Map<String, Object>> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(mapToJson(list.get(i)));
        }
        return sb.append("]").toString();
    }
}
