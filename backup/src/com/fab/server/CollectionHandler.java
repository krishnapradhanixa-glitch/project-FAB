package com.fab.server;

import com.fab.dao.CollectionDAO;
import com.fab.dao.AreaDAO;
import com.fab.dao.VehicleDAO;
import com.fab.model.CollectionActivity;
import com.fab.model.WasteCollectionRecord;
import com.fab.util.HttpUtil;
import com.fab.util.SessionManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;

/** Handles /api/collections/* and /api/dashboard */
public class CollectionHandler implements HttpHandler {
    private final CollectionDAO dao    = new CollectionDAO();
    private final AreaDAO areaDAO      = new AreaDAO();
    private final VehicleDAO vehicleDAO = new VehicleDAO();
    private static final Set<String> VALID_STATUSES   = Set.of("Scheduled","In Progress","Completed","Cancelled");
    private static final Set<String> VALID_CATEGORIES = Set.of("Biodegradable","Recyclable","Non-recyclable");

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if ("OPTIONS".equals(ex.getRequestMethod())) { HttpUtil.sendOptions(ex); return; }
        if (!SessionManager.isValid(SessionManager.extractToken(ex))) {
            HttpUtil.sendJson(ex, 401, "{\"error\":\"Unauthorized\"}"); return;
        }
        String method = ex.getRequestMethod();
        String path   = ex.getRequestURI().getPath();

        try {
            if (path.equals("/api/dashboard") && "GET".equals(method)) {
                handleDashboard(ex);
            } else {
                String[] parts = path.split("/");
                String id = parts.length >= 4 ? parts[3] : null;
                // sub-paths: /api/collections/{id}/waste
                boolean isWaste = path.contains("/waste");
                if (isWaste && id != null) {
                    handleGetWaste(ex, id); return;
                }
                switch (method) {
                    case "GET"    -> handleGet(ex, id);
                    case "POST"   -> handlePost(ex);
                    case "PUT"    -> handlePut(ex, id);
                    case "DELETE" -> handleDelete(ex, id);
                    default       -> HttpUtil.sendJson(ex, 405, "{\"error\":\"Method not allowed\"}");
                }
            }
        } catch (Exception e) {
            System.err.println("[CollectionHandler] " + e);
            HttpUtil.sendJson(ex, 500, "{\"error\":\"" + HttpUtil.esc(e.getMessage()) + "\"}");
        }
    }

    private void handleDashboard(HttpExchange ex) throws IOException, SQLException {
        Map<String,Object> stats = dao.getDashboardStats();
        HttpUtil.sendJson(ex, 200, mapToJson(stats));
    }

    private void handleGet(HttpExchange ex, String id) throws IOException, SQLException {
        if (id != null && !id.isBlank()) {
            CollectionActivity act = dao.findById(id);
            if (act == null) { HttpUtil.sendJson(ex,404,"{\"error\":\"Collection not found\"}"); return; }
            HttpUtil.sendJson(ex, 200, actToJson(act));
        } else {
            Map<String,String> params = HttpUtil.parseQuery(ex.getRequestURI().getQuery());
            List<CollectionActivity> list = dao.findAll(
                params.get("area"), params.get("vehicle"),
                params.get("status"), params.get("dateFrom"), params.get("dateTo"));
            StringBuilder sb = new StringBuilder("[");
            for (int i=0;i<list.size();i++) { if(i>0) sb.append(","); sb.append(actToJson(list.get(i))); }
            sb.append("]");
            HttpUtil.sendJson(ex, 200, sb.toString());
        }
    }

    private void handleGetWaste(HttpExchange ex, String id) throws IOException, SQLException {
        List<WasteCollectionRecord> records = dao.findWasteByCollection(id);
        StringBuilder sb = new StringBuilder("[");
        for (int i=0;i<records.size();i++) {
            WasteCollectionRecord r = records.get(i);
            if(i>0) sb.append(",");
            sb.append("{\"recordId\":").append(r.getRecordId())
              .append(",\"collectionId\":\"").append(HttpUtil.esc(r.getCollectionId()))
              .append("\",\"wasteCategory\":\"").append(HttpUtil.esc(r.getWasteCategory()))
              .append("\",\"quantity\":").append(r.getQuantity()).append("}");
        }
        sb.append("]");
        HttpUtil.sendJson(ex, 200, sb.toString());
    }

    private void handlePost(HttpExchange ex) throws IOException, SQLException {
        String rawBody = HttpUtil.readBody(ex);
        // Parse the top-level activity fields + wasteRecords array
        Map<String,String> body = HttpUtil.parseJsonBody(rawBody);
        CollectionActivity act = validateActivity(ex, body, true);
        if (act == null) return;
        List<WasteCollectionRecord> records = parseWasteRecords(ex, rawBody, act.getVehicleId());
        if (records == null) return;
        dao.createActivity(act, records);
        HttpUtil.sendJson(ex, 201, "{\"message\":\"Collection activity created\",\"collectionId\":\"" + HttpUtil.esc(act.getCollectionId()) + "\"}");
    }

    private void handlePut(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex,400,"{\"error\":\"Collection ID required\"}"); return; }
        if (!dao.exists(id)) { HttpUtil.sendJson(ex,404,"{\"error\":\"Collection not found\"}"); return; }
        String rawBody = HttpUtil.readBody(ex);
        Map<String,String> body = HttpUtil.parseJsonBody(rawBody);
        body.put("collectionId", id);
        CollectionActivity act = validateActivity(ex, body, false);
        if (act == null) return;
        List<WasteCollectionRecord> records = parseWasteRecords(ex, rawBody, act.getVehicleId());
        if (records == null) return;
        dao.updateActivity(act, records);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Collection activity updated\"}");
    }

    private void handleDelete(HttpExchange ex, String id) throws IOException, SQLException {
        if (id == null) { HttpUtil.sendJson(ex,400,"{\"error\":\"Collection ID required\"}"); return; }
        if (!dao.exists(id)) { HttpUtil.sendJson(ex,404,"{\"error\":\"Collection not found\"}"); return; }
        dao.deleteActivity(id);
        HttpUtil.sendJson(ex, 200, "{\"message\":\"Collection activity deleted\"}");
    }

    private CollectionActivity validateActivity(HttpExchange ex, Map<String,String> body, boolean requireId)
            throws IOException, SQLException {
        String collId   = body.getOrDefault("collectionId","").trim();
        String areaId   = body.getOrDefault("areaId","").trim();
        String vehicleId = body.getOrDefault("vehicleId","").trim();
        String dateStr  = body.getOrDefault("collectionDate","").trim();
        String status   = body.getOrDefault("status","").trim();

        if (requireId && collId.isEmpty()) { HttpUtil.sendJson(ex,400,"{\"error\":\"Collection ID is required\"}"); return null; }
        if (requireId && dao.exists(collId)) { HttpUtil.sendJson(ex,409,"{\"error\":\"Collection ID already exists\"}"); return null; }
        if (areaId.isEmpty() || !areaDAO.exists(areaId)) { HttpUtil.sendJson(ex,400,"{\"error\":\"Valid Area ID is required\"}"); return null; }
        if (vehicleId.isEmpty() || !vehicleDAO.exists(vehicleId)) { HttpUtil.sendJson(ex,400,"{\"error\":\"Valid Vehicle ID is required\"}"); return null; }
        if (!VALID_STATUSES.contains(status)) { HttpUtil.sendJson(ex,400,"{\"error\":\"Invalid status value\"}"); return null; }
        LocalDate date;
        try { date = LocalDate.parse(dateStr); }
        catch (Exception e) { HttpUtil.sendJson(ex,400,"{\"error\":\"Invalid date format (use YYYY-MM-DD)\"}"); return null; }

        CollectionActivity act = new CollectionActivity(collId, areaId, vehicleId, date, status);
        return act;
    }

    /**
     * Parse wasteRecords from the raw JSON body.
     * Expected format: {..., "wasteRecords": [{"wasteCategory":"Biodegradable","quantity":100}, ...]}
     * Also validates total quantity against vehicle capacity.
     */
    private List<WasteCollectionRecord> parseWasteRecords(HttpExchange ex, String rawBody, String vehicleId)
            throws IOException, SQLException {
        List<WasteCollectionRecord> records = new ArrayList<>();
        // Extract wasteRecords array from raw JSON
        int arrStart = rawBody.indexOf("\"wasteRecords\"");
        if (arrStart < 0) return records; // empty list is OK
        int open = rawBody.indexOf("[", arrStart);
        int close = rawBody.lastIndexOf("]");
        if (open < 0 || close < 0 || close < open) return records;
        String arrStr = rawBody.substring(open + 1, close).trim();
        if (arrStr.isEmpty()) return records;

        // Split objects in array by "}, {"
        String[] items = arrStr.split("\\},\\s*\\{");
        Map<String,Double> catMap = new LinkedHashMap<>();
        for (String item : items) {
            item = item.replace("{","").replace("}","").trim();
            Map<String,String> kv = HttpUtil.parseJsonBody("{" + item + "}");
            String cat = kv.getOrDefault("wasteCategory","").trim();
            String qtyStr = kv.getOrDefault("quantity","0").trim();
            if (!VALID_CATEGORIES.contains(cat)) { HttpUtil.sendJson(ex,400,"{\"error\":\"Invalid waste category: " + HttpUtil.esc(cat) + "\"}"); return null; }
            double qty;
            try { qty = Double.parseDouble(qtyStr); if (qty <= 0) throw new NumberFormatException(); }
            catch (NumberFormatException e) { HttpUtil.sendJson(ex,400,"{\"error\":\"Quantity must be greater than zero\"}"); return null; }
            // Merge duplicate categories
            catMap.merge(cat, qty, Double::sum);
        }
        // Check total vs vehicle capacity
        double total = catMap.values().stream().mapToDouble(Double::doubleValue).sum();
        var vehicle = vehicleDAO.findById(vehicleId);
        if (vehicle != null && total > vehicle.getCapacity()) {
            HttpUtil.sendJson(ex, 400, "{\"error\":\"Total waste (" + total + " kg) exceeds vehicle capacity (" + vehicle.getCapacity() + " kg)\"}");
            return null;
        }
        for (Map.Entry<String,Double> e : catMap.entrySet()) {
            records.add(new WasteCollectionRecord(0, null, e.getKey(), e.getValue()));
        }
        return records;
    }

    private String actToJson(CollectionActivity a) {
        return "{\"collectionId\":\"" + HttpUtil.esc(a.getCollectionId()) +
               "\",\"areaId\":\"" + HttpUtil.esc(a.getAreaId()) +
               "\",\"areaName\":\"" + HttpUtil.esc(a.getAreaName()) +
               "\",\"vehicleId\":\"" + HttpUtil.esc(a.getVehicleId()) +
               "\",\"collectionDate\":\"" + (a.getCollectionDate()!=null?a.getCollectionDate():"") +
               "\",\"status\":\"" + HttpUtil.esc(a.getStatus()) +
               "\",\"totalWaste\":" + a.getTotalWaste() + "}";
    }

    @SuppressWarnings("unchecked")
    private String mapToJson(Map<String,Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String,Object> e : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(HttpUtil.esc(e.getKey())).append("\":");
            Object v = e.getValue();
            if (v instanceof String)  sb.append("\"").append(HttpUtil.esc((String)v)).append("\"");
            else if (v instanceof Map) sb.append(mapToJson((Map<String,Object>)v));
            else sb.append(v);
        }
        sb.append("}");
        return sb.toString();
    }
}
