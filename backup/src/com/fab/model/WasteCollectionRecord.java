package com.fab.model;

/** Represents one waste category record for a collection activity. */
public class WasteCollectionRecord {
    private int recordId;
    private String collectionId;
    private String wasteCategory; // Biodegradable, Recyclable, Non-recyclable
    private double quantity;

    public WasteCollectionRecord() {}
    public WasteCollectionRecord(int recordId, String collectionId, String wasteCategory, double quantity) {
        this.recordId = recordId; this.collectionId = collectionId;
        this.wasteCategory = wasteCategory; this.quantity = quantity;
    }

    public int getRecordId() { return recordId; }
    public void setRecordId(int recordId) { this.recordId = recordId; }
    public String getCollectionId() { return collectionId; }
    public void setCollectionId(String collectionId) { this.collectionId = collectionId; }
    public String getWasteCategory() { return wasteCategory; }
    public void setWasteCategory(String wasteCategory) { this.wasteCategory = wasteCategory; }
    public double getQuantity() { return quantity; }
    public void setQuantity(double quantity) { this.quantity = quantity; }

    @Override public String toString() {
        return "WasteCollectionRecord{collectionId=" + collectionId + ", category=" + wasteCategory + ", qty=" + quantity + "}";
    }
}
