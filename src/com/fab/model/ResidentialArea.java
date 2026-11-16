package com.fab.model;

/** Represents a residential area. */
public class ResidentialArea {
    private String areaId;
    private String areaName;
    private String location;
    private int population;

    public ResidentialArea() {}
    public ResidentialArea(String areaId, String areaName, String location, int population) {
        this.areaId = areaId; this.areaName = areaName;
        this.location = location; this.population = population;
    }

    public String getAreaId() { return areaId; }
    public void setAreaId(String areaId) { this.areaId = areaId; }
    public String getAreaName() { return areaName; }
    public void setAreaName(String areaName) { this.areaName = areaName; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public int getPopulation() { return population; }
    public void setPopulation(int population) { this.population = population; }

    @Override public String toString() {
        return "ResidentialArea{id=" + areaId + ", name=" + areaName + "}";
    }
}
