package com.fab.dao;

import com.fab.model.CollectionVehicle;
import com.fab.util.DBUtil;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/** DAO for CollectionVehicle. */
public class VehicleDAO {

    public void create(CollectionVehicle v) throws SQLException {
        String sql = "INSERT INTO CollectionVehicle (VehicleID, VehicleType, Capacity) VALUES (?,?,?)";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, v.getVehicleId());
            ps.setString(2, v.getVehicleType());
            ps.setDouble(3, v.getCapacity());
            ps.executeUpdate();
        }
    }

    public List<CollectionVehicle> findAll() throws SQLException {
        List<CollectionVehicle> list = new ArrayList<>();
        String sql = "SELECT VehicleID, VehicleType, Capacity FROM CollectionVehicle ORDER BY VehicleID";
        try (Connection c = DBUtil.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(map(rs));
        }
        return list;
    }

    public CollectionVehicle findById(String vehicleId) throws SQLException {
        String sql = "SELECT VehicleID, VehicleType, Capacity FROM CollectionVehicle WHERE VehicleID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, vehicleId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return map(rs);
            return null;
        }
    }

    public List<CollectionVehicle> search(String keyword) throws SQLException {
        List<CollectionVehicle> list = new ArrayList<>();
        String sql = "SELECT VehicleID, VehicleType, Capacity FROM CollectionVehicle " +
                     "WHERE VehicleID LIKE ? OR VehicleType LIKE ? ORDER BY VehicleID";
        String k = "%" + keyword + "%";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, k); ps.setString(2, k);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(map(rs));
        }
        return list;
    }

    public int update(CollectionVehicle v) throws SQLException {
        String sql = "UPDATE CollectionVehicle SET VehicleType=?, Capacity=? WHERE VehicleID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, v.getVehicleType());
            ps.setDouble(2, v.getCapacity());
            ps.setString(3, v.getVehicleId());
            return ps.executeUpdate();
        }
    }

    public boolean delete(String vehicleId) throws SQLException {
        if (hasDependentActivities(vehicleId)) return false;
        String sql = "DELETE FROM CollectionVehicle WHERE VehicleID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, vehicleId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean hasDependentActivities(String vehicleId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM CollectionActivity WHERE VehicleID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, vehicleId);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    public boolean exists(String vehicleId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM CollectionVehicle WHERE VehicleID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, vehicleId);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    private CollectionVehicle map(ResultSet rs) throws SQLException {
        return new CollectionVehicle(rs.getString("VehicleID"), rs.getString("VehicleType"), rs.getDouble("Capacity"));
    }
}
