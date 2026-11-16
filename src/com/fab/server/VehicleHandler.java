package com.fab.server;

import com.fab.dao.VehicleDAO;
import com.fab.model.CollectionVehicle;
import com.fab.util.HttpUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

/** Handles /api/vehicles/* */
public class VehicleHandler implements HttpHandler {
    private final VehicleDAO dao = new VehicleDAO();

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { HttpUtil.sendOptions(ex); return; }
        if (!SessionManager.isValid(SessionManager.extractToken(ex))) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return;
        }
        String method = ex.getRequestMethod();
        String path   = ex.getRequestURI().getPath();
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
            System.err.println("[VehicleHandler] " + e.getMessage());
            HttpUtil.sendJson(ex, 500, "{\"error\":\"" + HttpUtil.esc(e.getMessage()) + "\"}");
        }
    }

    private void handleGet(HttpExchange ex, String id) throws IOException, SQLException {
        Map<String,String> params = HttpUtil.parseQuery(ex.getRequestURI().getQuery());
        if (id != null && !id.isBlank()) {
            CollectionVehicle v = dao.findById(id);
            if (v == null) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Vehicle not found\"}"); return; }
            HttpUtil.sendJson(ex, 200, vehicleToJson(v));
        } else if (params.containsKey("search")) {
            HttpUtil.sendJson(ex, 200, listToJson(dao.search(params.get("search"))));
        } else {
            HttpUtil.sendJson(ex, 200, listToJson(dao.findAll()));
        }
    }

    private void handlePost(HttpExchange ex) throws IOException, SQLException {
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        CollectionVehicle v = validate(ex, body, true);
        if (v == null) return;
        if (dao.exists(v.getVehicleId())) { HttpUtil.sendJson(ex, 409, "{\"error\":\"Vehicle ID already exists\"}"); return; }
        dao.create(v);
        HttpUtil.sendJson(ex, 201, "{\"message\":\"Vehicle added successfully\",\"vehicleId\":\"" + HttpUtil.esc(v.getVehicleId()) + "\"}");
    }

    private void handlePut(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex, 400, "{\"error\":\"Vehicle ID required\"}"); return; }
        Map<String,String> body = HttpUtil.parseJsonBody(HttpUtil.readBody(ex));
        body.put("vehicleId", id);
        CollectionVehicle v = validate(ex, body, false);
        if (v == null) return;
        if (!dao.exists(id)) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Vehicle not found\"}"); return; }
        dao.update(v);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Vehicle updated successfully\"}");
    }

    private void handleDelete(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex, 400, "{\"error\":\"Vehicle ID required\"}"); return; }
        if (!dao.exists(id)) { HttpUtil.sendJson(ex, 404, "{\"error\":\"Vehicle not found\"}"); return; }
        if (dao.hasDependentActivities(id)) {
            HttpUtil.sendJson(ex, 409, "{\"error\":\"Cannot delete: this vehicle has existing collection activities. Delete those records first.\"}"); return;
        }
        dao.delete(id);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Vehicle deleted successfully\"}");
    }

    private CollectionVehicle validate(HttpExchange ex, Map<String,String> body, boolean requireId) throws IOException {
        String vehicleId   = body.getOrDefault("vehicleId","").trim();
        String vehicleType = body.getOrDefault("vehicleType","").trim();
        String capStr      = body.getOrDefault("capacity","").trim();
        if (requireId && vehicleId.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Vehicle ID is required\"}"); return null; }
        if (vehicleType.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Vehicle Type is required\"}"); return null; }
        double capacity;
        try { capacity = Double.parseDouble(capStr); if (capacity <= 0) throw new NumberFormatException(); }
        catch (NumberFormatException e) { HttpUtil.sendJson(ex,400,"{\"error\":\"Capacity must be a positive number (kg)\"}"); return null; }
        return new CollectionVehicle(vehicleId, vehicleType, capacity);
    }

    private String vehicleToJson(CollectionVehicle v) {
        return "{\"vehicleId\":\"" + HttpUtil.esc(v.getVehicleId()) + "\",\"vehicleType\":\"" + HttpUtil.esc(v.getVehicleType()) +
               "\",\"capacity\":" + v.getCapacity() + "}";
    }

    private String listToJson(List<CollectionVehicle> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<list.size();i++) { if(i>0) sb.append(","); sb.append(vehicleToJson(list.get(i))); }
        sb.append("]"); return sb.toString();
    }
}
