package com.fab.dao;

import com.fab.util.DBUtil;
import java.sql.*;
import java.sql.Date;
import java.util.*;

/**
 * DAO for all report queries.
 * Demonstrates: GROUP BY, HAVING, aggregate functions, JOINs, date filters.
 */
public class ReportDAO {

    // ------------------------------------------------------------------ Area-wise Report
    public List<Map<String,Object>> getAreaWiseReport() throws SQLException {
        List<Map<String,Object>> list = new ArrayList<>();
        String sql = "SELECT ra.AreaID, ra.AreaName, ra.Population, " +
            "COALESCE(SUM(CASE WHEN wcr.WasteCategory='Biodegradable'  THEN wcr.Quantity ELSE 0 END),0) AS Biodegradable, " +
            "COALESCE(SUM(CASE WHEN wcr.WasteCategory='Recyclable'     THEN wcr.Quantity ELSE 0 END),0) AS Recyclable, " +
            "COALESCE(SUM(CASE WHEN wcr.WasteCategory='Non-recyclable' THEN wcr.Quantity ELSE 0 END),0) AS NonRecyclable, " +
            "COALESCE(SUM(wcr.Quantity),0) AS TotalWaste " +
            "FROM ResidentialArea ra " +
            "LEFT JOIN CollectionActivity ca ON ra.AreaID=ca.AreaID AND ca.Status='Completed' " +
            "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
            "GROUP BY ra.AreaID, ra.AreaName, ra.Population ORDER BY TotalWaste DESC";
        try (Connection c = DBUtil.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String,Object> row = new LinkedHashMap<>();
                row.put("areaId", rs.getString("AreaID"));
                row.put("areaName", rs.getString("AreaName"));
                row.put("population", rs.getInt("Population"));
                row.put("biodegradable", rs.getDouble("Biodegradable"));
                row.put("recyclable", rs.getDouble("Recyclable"));
                row.put("nonRecyclable", rs.getDouble("NonRecyclable"));
                row.put("totalWaste", rs.getDouble("TotalWaste"));
                list.add(row);
            }
        }
        return list;
    }

    // ------------------------------------------------------------------ Vehicle Utilization Report
    public List<Map<String,Object>> getVehicleUtilizationReport() throws SQLException {
        List<Map<String,Object>> list = new ArrayList<>();
        String sql = "SELECT cv.VehicleID, cv.VehicleType, cv.Capacity, " +
            "COUNT(DISTINCT ca.CollectionID) AS CompletedTrips, " +
            "COALESCE(SUM(wcr.Quantity),0) AS TotalWaste " +
            "FROM CollectionVehicle cv " +
            "LEFT JOIN CollectionActivity ca ON cv.VehicleID=ca.VehicleID AND ca.Status='Completed' " +
            "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
            "GROUP BY cv.VehicleID, cv.VehicleType, cv.Capacity ORDER BY cv.VehicleID";
        try (Connection c = DBUtil.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String,Object> row = new LinkedHashMap<>();
                row.put("vehicleId", rs.getString("VehicleID"));
                row.put("vehicleType", rs.getString("VehicleType"));
                row.put("capacity", rs.getDouble("Capacity"));
                int trips = rs.getInt("CompletedTrips");
                double totalWaste = rs.getDouble("TotalWaste");
                double cap = rs.getDouble("Capacity");
                row.put("completedTrips", trips);
                row.put("totalWaste", totalWaste);
                // Avg utilization across trips
                double avgUtil = computeAvgUtil(c, rs.getString("VehicleID"), cap);
                row.put("avgUtilizationPct", Math.round(avgUtil * 10.0) / 10.0);
                list.add(row);
            }
        }
        return list;
    }

    private double computeAvgUtil(Connection c, String vehicleId, double capacity) throws SQLException {
        String sql = "SELECT ca.CollectionID, COALESCE(SUM(wcr.Quantity),0) AS TripWaste " +
            "FROM CollectionActivity ca " +
            "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
            "WHERE ca.VehicleID=? AND ca.Status='Completed' GROUP BY ca.CollectionID";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, vehicleId);
            ResultSet rs = ps.executeQuery();
            List<Double> utils = new ArrayList<>();
            while (rs.next()) {
                double tripWaste = rs.getDouble("TripWaste");
                if (capacity > 0) utils.add(tripWaste / capacity * 100.0);
            }
            return utils.isEmpty() ? 0.0 : utils.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        }
    }

    // ------------------------------------------------------------------ Completion Report
    public List<Map<String,Object>> getCompletionReport(String areaFilter, String vehicleFilter,
                                                          String dateFrom, String dateTo) throws SQLException {
        List<Map<String,Object>> list = new ArrayList<>();
        StringBuilder sb = new StringBuilder(
            "SELECT ca.CollectionID, ra.AreaName, ca.VehicleID, ca.CollectionDate, ca.Status " +
            "FROM CollectionActivity ca JOIN ResidentialArea ra ON ca.AreaID=ra.AreaID WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (areaFilter!=null && !areaFilter.isBlank()) { sb.append(" AND ca.AreaID=?"); params.add(areaFilter); }
        if (vehicleFilter!=null && !vehicleFilter.isBlank()) { sb.append(" AND ca.VehicleID=?"); params.add(vehicleFilter); }
        if (dateFrom!=null && !dateFrom.isBlank()) { sb.append(" AND ca.CollectionDate>=?"); params.add(dateFrom); }
        if (dateTo!=null && !dateTo.isBlank()) { sb.append(" AND ca.CollectionDate<=?"); params.add(dateTo); }
        sb.append(" ORDER BY ca.CollectionDate DESC");
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sb.toString())) {
            for (int i=0;i<params.size();i++) ps.setObject(i+1, params.get(i));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String,Object> row = new LinkedHashMap<>();
                row.put("collectionId", rs.getString("CollectionID"));
                row.put("areaName", rs.getString("AreaName"));
                row.put("vehicleId", rs.getString("VehicleID"));
                Date d = rs.getDate("CollectionDate");
                row.put("collectionDate", d != null ? d.toString() : "");
                row.put("status", rs.getString("Status"));
                list.add(row);
            }
        }
        return list;
    }

    public Map<String,Object> getCompletionSummary(String areaFilter, String vehicleFilter,
                                                     String dateFrom, String dateTo) throws SQLException {
        Map<String,Object> s = new LinkedHashMap<>();
        StringBuilder sb = new StringBuilder(
            "SELECT Status, COUNT(*) AS Cnt FROM CollectionActivity WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (areaFilter!=null && !areaFilter.isBlank()) { sb.append(" AND AreaID=?"); params.add(areaFilter); }
        if (vehicleFilter!=null && !vehicleFilter.isBlank()) { sb.append(" AND VehicleID=?"); params.add(vehicleFilter); }
        if (dateFrom!=null && !dateFrom.isBlank()) { sb.append(" AND CollectionDate>=?"); params.add(dateFrom); }
        if (dateTo!=null && !dateTo.isBlank()) { sb.append(" AND CollectionDate<=?"); params.add(dateTo); }
        sb.append(" GROUP BY Status");
        Map<String,Integer> counts = new LinkedHashMap<>();
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sb.toString())) {
            for (int i=0;i<params.size();i++) ps.setObject(i+1, params.get(i));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) counts.put(rs.getString("Status"), rs.getInt("Cnt"));
        }
        int completed   = counts.getOrDefault("Completed", 0);
        int scheduled   = counts.getOrDefault("Scheduled", 0);
        int inProgress  = counts.getOrDefault("In Progress", 0);
        int cancelled   = counts.getOrDefault("Cancelled", 0);
        int total       = completed + scheduled + inProgress + cancelled;
        int nonCancelled = completed + scheduled + inProgress;
        s.put("completed", completed); s.put("scheduled", scheduled);
        s.put("inProgress", inProgress); s.put("cancelled", cancelled); s.put("total", total);
        s.put("completionPct", nonCancelled>0 ? Math.round(completed*100.0/nonCancelled*10)/10.0 : 0.0);
        return s;
    }

    // ------------------------------------------------------------------ Date-wise Report
    public List<Map<String,Object>> getDateWiseReport(String period, String dateFrom, String dateTo) throws SQLException {
        List<Map<String,Object>> list = new ArrayList<>();
        String groupExpr;
        switch (period == null ? "daily" : period.toLowerCase()) {
            case "weekly":  groupExpr = "YEARWEEK(ca.CollectionDate, 1)"; break;
            case "monthly": groupExpr = "DATE_FORMAT(ca.CollectionDate, '%Y-%m')"; break;
            default:        groupExpr = "ca.CollectionDate"; break;
        }
        StringBuilder sb = new StringBuilder(
            "SELECT " + groupExpr + " AS Period, COALESCE(SUM(wcr.Quantity),0) AS TotalWaste, COUNT(DISTINCT ca.CollectionID) AS Activities " +
            "FROM CollectionActivity ca " +
            "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
            "WHERE ca.Status='Completed'");
        List<Object> params = new ArrayList<>();
        if (dateFrom!=null && !dateFrom.isBlank()) { sb.append(" AND ca.CollectionDate>=?"); params.add(dateFrom); }
        if (dateTo!=null && !dateTo.isBlank()) { sb.append(" AND ca.CollectionDate<=?"); params.add(dateTo); }
        sb.append(" GROUP BY Period ORDER BY Period");
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sb.toString())) {
            for (int i=0;i<params.size();i++) ps.setObject(i+1, params.get(i));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Map<String,Object> row = new LinkedHashMap<>();
                row.put("period", rs.getString("Period"));
                row.put("totalWaste", rs.getDouble("TotalWaste"));
                row.put("activities", rs.getInt("Activities"));
                list.add(row);
            }
        }
        return list;
    }
}
