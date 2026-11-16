package com.fab.model;

import java.time.LocalDate;

/** Represents a single waste collection activity. */
public class CollectionActivity {
    private String collectionId;
    private String areaId;
    private String areaName;    // joined display field
    private String vehicleId;
    private LocalDate collectionDate;
    private String status;      // Scheduled, In Progress, Completed, Cancelled
    private double totalWaste;  // derived from WasteCollectionRecord

    public CollectionActivity() {}
    public CollectionActivity(String collectionId, String areaId, String vehicleId,
                               LocalDate collectionDate, String status) {
        this.collectionId = collectionId; this.areaId = areaId;
        this.vehicleId = vehicleId; this.collectionDate = collectionDate; this.status = status;
    }

    public String getCollectionId() { return collectionId; }
    public void setCollectionId(String collectionId) { this.collectionId = collectionId; }
    public String getAreaId() { return areaId; }
    public void setAreaId(String areaId) { this.areaId = areaId; }
    public String getAreaName() { return areaName; }
    public void setAreaName(String areaName) { this.areaName = areaName; }
    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }
    public LocalDate getCollectionDate() { return collectionDate; }
    public void setCollectionDate(LocalDate collectionDate) { this.collectionDate = collectionDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public double getTotalWaste() { return totalWaste; }
    public void setTotalWaste(double totalWaste) { this.totalWaste = totalWaste; }

    @Override public String toString() {
        return "CollectionActivity{id=" + collectionId + ", area=" + areaId + ", status=" + status + "}";
    }
}
