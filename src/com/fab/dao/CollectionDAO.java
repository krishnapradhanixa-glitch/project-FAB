package com.fab.dao;

import com.fab.model.CollectionActivity;
import com.fab.model.WasteCollectionRecord;
import com.fab.util.DBUtil;
import java.sql.*;
import java.sql.Date;
import java.time.LocalDate;
import java.util.*;

/**
 * DAO for CollectionActivity and WasteCollectionRecord.
 * Demonstrates: Joins, GROUP BY, aggregate functions, transactions.
 */
public class CollectionDAO {

    private static final Set<String> VALID_STATUSES = Set.of("Scheduled","In Progress","Completed","Cancelled");
    private static final Set<String> VALID_CATEGORIES = Set.of("Biodegradable","Recyclable","Non-recyclable");

    // ------------------------------------------------------------------ ACTIVITY CRUD

    public void createActivity(CollectionActivity act, List<WasteCollectionRecord> records) throws SQLException {
        Connection c = DBUtil.getConnection();
        try {
            c.setAutoCommit(false);
            String sql = "INSERT INTO CollectionActivity (CollectionID,AreaID,VehicleID,CollectionDate,Status) VALUES(?,?,?,?,?)";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, act.getCollectionId());
                ps.setString(2, act.getAreaId());
                ps.setString(3, act.getVehicleId());
                ps.setDate(4, Date.valueOf(act.getCollectionDate()));
                ps.setString(5, act.getStatus());
                ps.executeUpdate();
            }
            insertWasteRecords(c, act.getCollectionId(), records);
            c.commit();
        } catch (SQLException e) {
            c.rollback();
            throw e;
        } finally {
            c.setAutoCommit(true);
            c.close();
        }
    }

    public List<CollectionActivity> findAll(String areaFilter, String vehicleFilter, String statusFilter,
                                             String dateFrom, String dateTo) throws SQLException {
        List<CollectionActivity> list = new ArrayList<>();
        StringBuilder sb = new StringBuilder(
            "SELECT ca.CollectionID, ca.AreaID, ra.AreaName, ca.VehicleID, ca.CollectionDate, ca.Status, " +
            "COALESCE(SUM(wcr.Quantity),0) AS TotalWaste " +
            "FROM CollectionActivity ca " +
            "JOIN ResidentialArea ra ON ca.AreaID=ra.AreaID " +
            "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
            "WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (areaFilter != null && !areaFilter.isBlank()) { sb.append(" AND ca.AreaID=?"); params.add(areaFilter); }
        if (vehicleFilter != null && !vehicleFilter.isBlank()) { sb.append(" AND ca.VehicleID=?"); params.add(vehicleFilter); }
        if (statusFilter != null && !statusFilter.isBlank()) { sb.append(" AND ca.Status=?"); params.add(statusFilter); }
        if (dateFrom != null && !dateFrom.isBlank()) { sb.append(" AND ca.CollectionDate>=?"); params.add(dateFrom); }
        if (dateTo != null && !dateTo.isBlank()) { sb.append(" AND ca.CollectionDate<=?"); params.add(dateTo); }
        sb.append(" GROUP BY ca.CollectionID, ca.AreaID, ra.AreaName, ca.VehicleID, ca.CollectionDate, ca.Status");
        sb.append(" ORDER BY ca.CollectionDate DESC");
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sb.toString())) {
            for (int i = 0; i < params.size(); i++) ps.setObject(i + 1, params.get(i));
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapActivity(rs));
        }
        return list;
    }

    public CollectionActivity findById(String collectionId) throws SQLException {
        String sql = "SELECT ca.CollectionID, ca.AreaID, ra.AreaName, ca.VehicleID, ca.CollectionDate, ca.Status," +
                     "COALESCE(SUM(wcr.Quantity),0) AS TotalWaste " +
                     "FROM CollectionActivity ca " +
                     "JOIN ResidentialArea ra ON ca.AreaID=ra.AreaID " +
                     "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
                     "WHERE ca.CollectionID=? GROUP BY ca.CollectionID,ca.AreaID,ra.AreaName,ca.VehicleID,ca.CollectionDate,ca.Status";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, collectionId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return mapActivity(rs);
            return null;
        }
    }

    public void updateActivity(CollectionActivity act, List<WasteCollectionRecord> records) throws SQLException {
        Connection c = DBUtil.getConnection();
        try {
            c.setAutoCommit(false);
            String sql = "UPDATE CollectionActivity SET AreaID=?,VehicleID=?,CollectionDate=?,Status=? WHERE CollectionID=?";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, act.getAreaId());
                ps.setString(2, act.getVehicleId());
                ps.setDate(3, Date.valueOf(act.getCollectionDate()));
                ps.setString(4, act.getStatus());
                ps.setString(5, act.getCollectionId());
                ps.executeUpdate();
            }
            // Replace waste records
            try (PreparedStatement del = c.prepareStatement("DELETE FROM WasteCollectionRecord WHERE CollectionID=?")) {
                del.setString(1, act.getCollectionId()); del.executeUpdate();
            }
            insertWasteRecords(c, act.getCollectionId(), records);
            c.commit();
        } catch (SQLException e) {
            c.rollback(); throw e;
        } finally {
            c.setAutoCommit(true); c.close();
        }
    }

    public void deleteActivity(String collectionId) throws SQLException {
        Connection c = DBUtil.getConnection();
        try {
            c.setAutoCommit(false);
            try (PreparedStatement del = c.prepareStatement("DELETE FROM WasteCollectionRecord WHERE CollectionID=?")) {
                del.setString(1, collectionId); del.executeUpdate();
            }
            try (PreparedStatement del = c.prepareStatement("DELETE FROM CollectionActivity WHERE CollectionID=?")) {
                del.setString(1, collectionId); del.executeUpdate();
            }
            c.commit();
        } catch (SQLException e) {
            c.rollback(); throw e;
        } finally {
            c.setAutoCommit(true); c.close();
        }
    }

    public boolean exists(String collectionId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM CollectionActivity WHERE CollectionID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, collectionId);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    // ------------------------------------------------------------------ WASTE RECORDS

    public List<WasteCollectionRecord> findWasteByCollection(String collectionId) throws SQLException {
        List<WasteCollectionRecord> list = new ArrayList<>();
        String sql = "SELECT RecordID, CollectionID, WasteCategory, Quantity FROM WasteCollectionRecord WHERE CollectionID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, collectionId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                list.add(new WasteCollectionRecord(rs.getInt("RecordID"), rs.getString("CollectionID"),
                    rs.getString("WasteCategory"), rs.getDouble("Quantity")));
            }
        }
        return list;
    }

    private void insertWasteRecords(Connection c, String collectionId, List<WasteCollectionRecord> records) throws SQLException {
        if (records == null || records.isEmpty()) return;
        String sql = "INSERT INTO WasteCollectionRecord (CollectionID, WasteCategory, Quantity) VALUES (?,?,?) " +
                     "ON DUPLICATE KEY UPDATE Quantity=VALUES(Quantity)";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (WasteCollectionRecord r : records) {
                ps.setString(1, collectionId);
                ps.setString(2, r.getWasteCategory());
                ps.setDouble(3, r.getQuantity());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    // ------------------------------------------------------------------ DASHBOARD STATS

    public Map<String, Object> getDashboardStats() throws SQLException {
        Map<String, Object> stats = new LinkedHashMap<>();
        try (Connection c = DBUtil.getConnection()) {
            stats.put("totalAreas",    queryInt(c, "SELECT COUNT(*) FROM ResidentialArea"));
            stats.put("totalVehicles", queryInt(c, "SELECT COUNT(*) FROM CollectionVehicle"));
            stats.put("totalActivities", queryInt(c, "SELECT COUNT(*) FROM CollectionActivity"));
            stats.put("completedActivities", queryInt(c, "SELECT COUNT(*) FROM CollectionActivity WHERE Status='Completed'"));
            stats.put("scheduledActivities", queryInt(c, "SELECT COUNT(*) FROM CollectionActivity WHERE Status='Scheduled'"));
            stats.put("inProgressActivities", queryInt(c, "SELECT COUNT(*) FROM CollectionActivity WHERE Status='In Progress'"));
            stats.put("cancelledActivities", queryInt(c, "SELECT COUNT(*) FROM CollectionActivity WHERE Status='Cancelled'"));
            stats.put("totalWasteCollected", queryDouble(c,
                "SELECT COALESCE(SUM(wcr.Quantity),0) FROM WasteCollectionRecord wcr " +
                "JOIN CollectionActivity ca ON wcr.CollectionID=ca.CollectionID WHERE ca.Status='Completed'"));
            // Highest waste area
            String hwSql = "SELECT ra.AreaName, COALESCE(SUM(wcr.Quantity),0) AS TW " +
                "FROM ResidentialArea ra LEFT JOIN CollectionActivity ca ON ra.AreaID=ca.AreaID AND ca.Status='Completed' " +
                "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
                "GROUP BY ra.AreaID, ra.AreaName ORDER BY TW DESC LIMIT 1";
            try (PreparedStatement ps = c.prepareStatement(hwSql); ResultSet rs = ps.executeQuery()) {
                if (rs.next()) { stats.put("highestWasteArea", rs.getString("AreaName")); stats.put("highestWasteQty", rs.getDouble("TW")); }
            }
            // Lowest waste area
            String lwSql = "SELECT ra.AreaName, COALESCE(SUM(wcr.Quantity),0) AS TW " +
                "FROM ResidentialArea ra LEFT JOIN CollectionActivity ca ON ra.AreaID=ca.AreaID AND ca.Status='Completed' " +
                "LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID=wcr.CollectionID " +
                "GROUP BY ra.AreaID, ra.AreaName HAVING TW > 0 ORDER BY TW ASC LIMIT 1";
            try (PreparedStatement ps = c.prepareStatement(lwSql); ResultSet rs = ps.executeQuery()) {
                if (rs.next()) { stats.put("lowestWasteArea", rs.getString("AreaName")); stats.put("lowestWasteQty", rs.getDouble("TW")); }
            }
            // Category distribution
            String catSql = "SELECT wcr.WasteCategory, COALESCE(SUM(wcr.Quantity),0) AS TQ " +
                "FROM WasteCollectionRecord wcr JOIN CollectionActivity ca ON wcr.CollectionID=ca.CollectionID " +
                "WHERE ca.Status='Completed' GROUP BY wcr.WasteCategory";
            Map<String,Double> cats = new LinkedHashMap<>();
            try (PreparedStatement ps = c.prepareStatement(catSql); ResultSet rs = ps.executeQuery()) {
                while (rs.next()) cats.put(rs.getString("WasteCategory"), rs.getDouble("TQ"));
            }
            stats.put("categoryDistribution", cats);
            // Completion rate
            int completed = (int) stats.get("completedActivities");
            int notCancelled = (int) stats.get("totalActivities") - (int) stats.get("cancelledActivities");
            stats.put("completionRate", notCancelled > 0 ? Math.round(completed * 100.0 / notCancelled * 10) / 10.0 : 0.0);
        }
        return stats;
    }

    private int queryInt(Connection c, String sql) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
    private double queryDouble(Connection c, String sql) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getDouble(1) : 0.0;
        }
    }

    private CollectionActivity mapActivity(ResultSet rs) throws SQLException {
        CollectionActivity act = new CollectionActivity();
        act.setCollectionId(rs.getString("CollectionID"));
        act.setAreaId(rs.getString("AreaID"));
        act.setAreaName(rs.getString("AreaName"));
        act.setVehicleId(rs.getString("VehicleID"));
        Date d = rs.getDate("CollectionDate");
        if (d != null) act.setCollectionDate(d.toLocalDate());
        act.setStatus(rs.getString("Status"));
        act.setTotalWaste(rs.getDouble("TotalWaste"));
        return act;
    }
}
