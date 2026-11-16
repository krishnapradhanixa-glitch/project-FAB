package com.fab.dao;

import com.fab.model.ResidentialArea;
import com.fab.util.DBUtil;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * DAO for ResidentialArea.
 * Demonstrates: INSERT, SELECT, UPDATE, DELETE, WHERE, ORDER BY.
 */
public class AreaDAO {

    public void create(ResidentialArea area) throws SQLException {
        String sql = "INSERT INTO ResidentialArea (AreaID, AreaName, Location, Population) VALUES (?,?,?,?)";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, area.getAreaId());
            ps.setString(2, area.getAreaName());
            ps.setString(3, area.getLocation());
            ps.setInt(4, area.getPopulation());
            ps.executeUpdate();
        }
    }

    public List<ResidentialArea> findAll() throws SQLException {
        List<ResidentialArea> list = new ArrayList<>();
        String sql = "SELECT AreaID, AreaName, Location, Population FROM ResidentialArea ORDER BY AreaName";
        try (Connection c = DBUtil.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(map(rs));
        }
        return list;
    }

    public ResidentialArea findById(String areaId) throws SQLException {
        String sql = "SELECT AreaID, AreaName, Location, Population FROM ResidentialArea WHERE AreaID = ?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, areaId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return map(rs);
            return null;
        }
    }

    public List<ResidentialArea> search(String keyword) throws SQLException {
        List<ResidentialArea> list = new ArrayList<>();
        String sql = "SELECT AreaID, AreaName, Location, Population FROM ResidentialArea " +
                     "WHERE AreaID LIKE ? OR AreaName LIKE ? OR Location LIKE ? ORDER BY AreaName";
        String k = "%" + keyword + "%";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, k); ps.setString(2, k); ps.setString(3, k);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(map(rs));
        }
        return list;
    }

    public int update(ResidentialArea area) throws SQLException {
        String sql = "UPDATE ResidentialArea SET AreaName=?, Location=?, Population=? WHERE AreaID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, area.getAreaName());
            ps.setString(2, area.getLocation());
            ps.setInt(3, area.getPopulation());
            ps.setString(4, area.getAreaId());
            return ps.executeUpdate();
        }
    }

    public boolean delete(String areaId) throws SQLException {
        // Check referential integrity first
        if (hasDependentActivities(areaId)) return false;
        String sql = "DELETE FROM ResidentialArea WHERE AreaID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, areaId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean hasDependentActivities(String areaId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM CollectionActivity WHERE AreaID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, areaId);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    public boolean exists(String areaId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM ResidentialArea WHERE AreaID=?";
        try (Connection c = DBUtil.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, areaId);
            ResultSet rs = ps.executeQuery();
            return rs.next() && rs.getInt(1) > 0;
        }
    }

    private ResidentialArea map(ResultSet rs) throws SQLException {
        return new ResidentialArea(
            rs.getString("AreaID"), rs.getString("AreaName"),
            rs.getString("Location"), rs.getInt("Population"));
    }
}
