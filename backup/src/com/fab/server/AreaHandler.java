package com.fab.server;

import com.fab.dao.AreaDAO;
import com.fab.model.ResidentialArea;
import com.fab.util.HttpUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/** Handles /api/areas/* */
public class AreaHandler implements HttpHandler {
    private final AreaDAO dao = new AreaDAO();

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { HttpUtil.sendOptions(ex); return; }
        if (!SessionManager.isValid(SessionManager.extractToken(ex))) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return;
        }
        String method = ex.getRequestMethod();
        String path   = ex.getRequestURI().getPath(); // /api/areas or /api/areas/{id}
        String[] parts = path.split("/");
        String id = parts.length >= 4 ? parts[3] : null;
        try {
            switch (method) {
                case "GET"    -> handleGet(ex, id);
                case "POST"   -> handlePost(ex);
                case "PUT"    -> handlePut(ex, id);
                case "DELETE" -> handleDelete(ex, id);
                default       -> HttpUtil.sendJson(ex, 405, "{\"error\":\"Method not allowed\"}");
            }
        } catch (Exception e) {
            System.err.println("[AreaHandler] " + e.getMessage());
            HttpUtil.sendJson(ex, 500, "{\"error\":\"" + HttpUtil.esc(e.getMessage()) + "\"}");
        }
    }

    private void handleGet(HttpExchange ex, String id) throws IOException, SQLException {
        String query = ex.getRequestURI().getQuery();
        Map<String,String> params = HttpUtil.parseQuery(query);
        if (id != null && !id.isBlank()) {
            ResidentialArea area = dao.findById(id);
            if (area == null) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Area not found\"}"); return; }
            HttpUtil.sendJson(ex, 200, areaToJson(area));
        } else if (params.containsKey("search")) {
            List<ResidentialArea> list = dao.search(params.get("search"));
            HttpUtil.sendJson(ex, 200, listToJson(list));
        } else {
            List<ResidentialArea> list = dao.findAll();
            HttpUtil.sendJson(ex, 200, listToJson(list));
        }
    }

    private void handlePost(HttpExchange ex) throws IOException, SQLException {
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        ResidentialArea area = validate(ex, body, true);
        if (area == null) return;
        if (dao.exists(area.getAreaId())) { HttpUtil.sendJson(ex, 409, "{\"error\":\"Area ID already exists\"}"); return; }
        dao.create(area);
        HttpUtil.sendJson(ex, 201, "{\"message\":\"Area created successfully\",\"areaId\":\"" + HttpUtil.esc(area.getAreaId()) + "\"}");
    }

    private void handlePut(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex, 400, "{\"error\":\"Area ID required\"}"); return; }
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        body.put("areaId", id);
        ResidentialArea area = validate(ex, body, false);
        if (area == null) return;
        if (!dao.exists(id)) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Area not found\"}"); return; }
        dao.update(area);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Area updated successfully\"}");
    }

    private void handleDelete(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex, 400, "{\"error\":\"Area ID required\"}"); return; }
        if (!dao.exists(id)) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Area not found\"}"); return; }
        if (dao.hasDependentActivities(id)) {
            HttpUtil.sendJson(ex, 409, "{\"error\":\"Cannot delete: this area has existing collection activities. Delete those records first.\"}"); return;
        }
        dao.delete(id);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Area deleted successfully\"}");
    }

    private ResidentialArea validate(HttpExchange ex, Map<String,String> body, boolean requireId) throws IOException {
        String areaId   = body.getOrDefault("areaId","").trim();
        String areaName = body.getOrDefault("areaName","").trim();
        String location = body.getOrDefault("location","").trim();
        String popStr   = body.getOrDefault("population","").trim();
        if (requireId && areaId.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Area ID is required\"}"); return null; }
        if (areaName.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Area Name is required\"}"); return null; }
        if (location.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Location is required\"}"); return null; }
        int population;
        try { population = Integer.parseInt(popStr); if (population <= 0) throw new NumberFormatException(); }
        catch (NumberFormatException e) { HttpUtil.sendJson(ex,400,"{\"error\":\"Population must be a positive integer\"}"); return null; }
        return new ResidentialArea(areaId, areaName, location, population);
    }

    private String areaToJson(ResidentialArea a) {
        return "{\"areaId\":\"" + HttpUtil.esc(a.getAreaId()) + "\",\"areaName\":\"" + HttpUtil.esc(a.getAreaName()) +
               "\",\"location\":\"" + HttpUtil.esc(a.getLocation()) + "\",\"population\":" + a.getPopulation() + "}";
    }

    private String listToJson(List<ResidentialArea> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<list.size();i++) {
            if (i>0) sb.append(",");
            sb.append(areaToJson(list.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }
}
