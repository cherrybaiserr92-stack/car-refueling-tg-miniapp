package com.example.refuel.model;

public class RefuelRequest {
    private int id;
    private double lat;
    private double lng;
    private String carModel;
    private int fuelLevel;
    private String status;
    private String address;

    public RefuelRequest(int id, double lat, double lng, String carModel,
                         int fuelLevel, String status, String address) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.carModel = carModel;
        this.fuelLevel = fuelLevel;
        this.status = status;
        this.address = address;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }
    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }
    public String getCarModel() { return carModel; }
    public void setCarModel(String carModel) { this.carModel = carModel; }
    public int getFuelLevel() { return fuelLevel; }
    public void setFuelLevel(int fuelLevel) { this.fuelLevel = fuelLevel; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}
