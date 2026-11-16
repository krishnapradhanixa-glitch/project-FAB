-- ============================================================
-- PROJECT FAB — Waste Collection Record Management System
-- Database Schema and Sample Data
-- ============================================================

CREATE DATABASE IF NOT EXISTS projectfab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE projectfab;

-- ============================================================
-- TABLE 1: Users
-- ============================================================
CREATE TABLE IF NOT EXISTS Users (
    UserID      INT AUTO_INCREMENT PRIMARY KEY,
    FullName    VARCHAR(100) NOT NULL,
    Email       VARCHAR(150) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (Email)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 2: ResidentialArea
-- ============================================================
CREATE TABLE IF NOT EXISTS ResidentialArea (
    AreaID      VARCHAR(20) PRIMARY KEY,
    AreaName    VARCHAR(100) NOT NULL,
    Location    VARCHAR(200) NOT NULL,
    Population  INT NOT NULL CHECK (Population > 0),
    INDEX idx_area_name (AreaName)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 3: CollectionVehicle
-- ============================================================
CREATE TABLE IF NOT EXISTS CollectionVehicle (
    VehicleID   VARCHAR(20) PRIMARY KEY,
    VehicleType VARCHAR(100) NOT NULL,
    Capacity    DOUBLE NOT NULL CHECK (Capacity > 0),
    INDEX idx_vehicle_type (VehicleType)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 4: CollectionActivity
-- ============================================================
CREATE TABLE IF NOT EXISTS CollectionActivity (
    CollectionID    VARCHAR(20) PRIMARY KEY,
    AreaID          VARCHAR(20) NOT NULL,
    VehicleID       VARCHAR(20) NOT NULL,
    CollectionDate  DATE NOT NULL,
    Status          ENUM('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
    CONSTRAINT fk_activity_area    FOREIGN KEY (AreaID)    REFERENCES ResidentialArea(AreaID),
    CONSTRAINT fk_activity_vehicle FOREIGN KEY (VehicleID) REFERENCES CollectionVehicle(VehicleID),
    INDEX idx_activity_area   (AreaID),
    INDEX idx_activity_vehicle(VehicleID),
    INDEX idx_activity_date   (CollectionDate),
    INDEX idx_activity_status (Status)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 5: WasteCollectionRecord
-- ============================================================
CREATE TABLE IF NOT EXISTS WasteCollectionRecord (
    RecordID        INT AUTO_INCREMENT PRIMARY KEY,
    CollectionID    VARCHAR(20) NOT NULL,
    WasteCategory   ENUM('Biodegradable','Recyclable','Non-recyclable') NOT NULL,
    Quantity        DOUBLE NOT NULL CHECK (Quantity > 0),
    CONSTRAINT fk_record_collection FOREIGN KEY (CollectionID) REFERENCES CollectionActivity(CollectionID),
    UNIQUE KEY uq_record_collection_category (CollectionID, WasteCategory),
    INDEX idx_record_collection (CollectionID),
    INDEX idx_record_category   (WasteCategory)
) ENGINE=InnoDB;

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW vw_area_waste_summary AS
SELECT
    ra.AreaID,
    ra.AreaName,
    ra.Location,
    ra.Population,
    COALESCE(SUM(CASE WHEN wcr.WasteCategory = 'Biodegradable'  THEN wcr.Quantity ELSE 0 END), 0) AS TotalBiodegradable,
    COALESCE(SUM(CASE WHEN wcr.WasteCategory = 'Recyclable'     THEN wcr.Quantity ELSE 0 END), 0) AS TotalRecyclable,
    COALESCE(SUM(CASE WHEN wcr.WasteCategory = 'Non-recyclable' THEN wcr.Quantity ELSE 0 END), 0) AS TotalNonRecyclable,
    COALESCE(SUM(wcr.Quantity), 0) AS TotalWaste
FROM ResidentialArea ra
LEFT JOIN CollectionActivity ca ON ra.AreaID = ca.AreaID AND ca.Status != 'Cancelled'
LEFT JOIN WasteCollectionRecord wcr ON ca.CollectionID = wcr.CollectionID
GROUP BY ra.AreaID, ra.AreaName, ra.Location, ra.Population;

CREATE OR REPLACE VIEW vw_vehicle_utilization AS
SELECT
    cv.VehicleID,
    cv.VehicleType,
    cv.Capacity,
    COUNT(DISTINCT CASE WHEN ca.Status = 'Completed' THEN ca.CollectionID END) AS CompletedTrips,
    COALESCE(AVG(CASE WHEN ca.Status = 'Completed'
        THEN (SELECT SUM(wcr2.Quantity) FROM WasteCollectionRecord wcr2 WHERE wcr2.CollectionID = ca.CollectionID) / cv.Capacity * 100
    END), 0) AS AvgUtilizationPct,
    COALESCE(SUM(CASE WHEN ca.Status = 'Completed' THEN
        (SELECT SUM(wcr2.Quantity) FROM WasteCollectionRecord wcr2 WHERE wcr2.CollectionID = ca.CollectionID)
    END), 0) AS TotalWasteCollected
FROM CollectionVehicle cv
LEFT JOIN CollectionActivity ca ON cv.VehicleID = ca.VehicleID
GROUP BY cv.VehicleID, cv.VehicleType, cv.Capacity;

-- ============================================================
-- SAMPLE DEMONSTRATION DATA
-- (Clearly identified as sample records for testing)
-- ============================================================

-- Sample Residential Areas
INSERT IGNORE INTO ResidentialArea (AreaID, AreaName, Location, Population) VALUES
('AREA001', 'Green Valley',    'North Sector, Zone A', 12500),
('AREA002', 'Sunrise Colony',  'East Sector, Zone B',  8200),
('AREA003', 'Blue Ridge',      'West Sector, Zone C',  15000),
('AREA004', 'Palm Heights',    'South Sector, Zone D', 6800),
('AREA005', 'Central Park',    'Central Zone',          21000);

-- Sample Vehicles
INSERT IGNORE INTO CollectionVehicle (VehicleID, VehicleType, Capacity) VALUES
('VEH001', 'Compactor Truck',    5000.0),
('VEH002', 'Tipper Truck',       3000.0),
('VEH003', 'Mini Garbage Truck', 1500.0),
('VEH004', 'Open Body Truck',    4000.0),
('VEH005', 'Compactor Truck',    5000.0);

-- Sample Collection Activities
INSERT IGNORE INTO CollectionActivity (CollectionID, AreaID, VehicleID, CollectionDate, Status) VALUES
('COL001', 'AREA001', 'VEH001', '2026-10-01', 'Completed'),
('COL002', 'AREA002', 'VEH002', '2026-10-02', 'Completed'),
('COL003', 'AREA003', 'VEH001', '2026-10-03', 'Completed'),
('COL004', 'AREA004', 'VEH003', '2026-10-05', 'Completed'),
('COL005', 'AREA005', 'VEH004', '2026-10-07', 'Completed'),
('COL006', 'AREA001', 'VEH002', '2026-10-08', 'Completed'),
('COL007', 'AREA002', 'VEH003', '2026-10-10', 'In Progress'),
('COL008', 'AREA003', 'VEH004', '2026-10-12', 'Scheduled'),
('COL009', 'AREA004', 'VEH001', '2026-10-14', 'Cancelled'),
('COL010', 'AREA005', 'VEH005', '2026-10-15', 'Completed'),
('COL011', 'AREA001', 'VEH003', '2026-10-18', 'Completed'),
('COL012', 'AREA002', 'VEH004', '2026-10-20', 'Completed'),
('COL013', 'AREA003', 'VEH002', '2026-10-22', 'Completed'),
('COL014', 'AREA005', 'VEH001', '2026-10-25', 'Scheduled'),
('COL015', 'AREA004', 'VEH005', '2026-10-28', 'Completed');

-- Sample Waste Collection Records
INSERT IGNORE INTO WasteCollectionRecord (CollectionID, WasteCategory, Quantity) VALUES
('COL001', 'Biodegradable',  1800.0),
('COL001', 'Recyclable',      900.0),
('COL001', 'Non-recyclable',  600.0),
('COL002', 'Biodegradable',  1100.0),
('COL002', 'Recyclable',      650.0),
('COL002', 'Non-recyclable',  450.0),
('COL003', 'Biodegradable',  2200.0),
('COL003', 'Recyclable',     1300.0),
('COL003', 'Non-recyclable',  800.0),
('COL004', 'Biodegradable',   500.0),
('COL004', 'Recyclable',      350.0),
('COL004', 'Non-recyclable',  250.0),
('COL005', 'Biodegradable',  1600.0),
('COL005', 'Recyclable',     1000.0),
('COL005', 'Non-recyclable',  700.0),
('COL006', 'Biodegradable',  1200.0),
('COL006', 'Recyclable',      700.0),
('COL007', 'Biodegradable',   400.0),
('COL007', 'Recyclable',      200.0),
('COL010', 'Biodegradable',  2000.0),
('COL010', 'Recyclable',     1200.0),
('COL010', 'Non-recyclable',  900.0),
('COL011', 'Biodegradable',   700.0),
('COL011', 'Recyclable',      400.0),
('COL011', 'Non-recyclable',  280.0),
('COL012', 'Biodegradable',   900.0),
('COL012', 'Recyclable',      550.0),
('COL012', 'Non-recyclable',  350.0),
('COL013', 'Biodegradable',  1400.0),
('COL013', 'Recyclable',      800.0),
('COL013', 'Non-recyclable',  500.0),
('COL015', 'Biodegradable',   600.0),
('COL015', 'Recyclable',      350.0),
('COL015', 'Non-recyclable',  200.0);
