package com.fab.model;

/** Represents a waste collection vehicle. */
public class CollectionVehicle {
    private String vehicleId;
    private String vehicleType;
    private double capacity;

    public CollectionVehicle() {}
    public CollectionVehicle(String vehicleId, String vehicleType, double capacity) {
        this.vehicleId = vehicleId; this.vehicleType = vehicleType; this.capacity = capacity;
    }

    public String getVehicleId() { return vehicleId; }
    public void setVehicleId(String vehicleId) { this.vehicleId = vehicleId; }
    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String vehicleType) { this.vehicleType = vehicleType; }
    public double getCapacity() { return capacity; }
    public void setCapacity(double capacity) { this.capacity = capacity; }

    @Override public String toString() {
        return "CollectionVehicle{id=" + vehicleId + ", type=" + vehicleType + ", capacity=" + capacity + "}";
    }
}
