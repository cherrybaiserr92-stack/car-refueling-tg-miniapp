package com.example.refuel.model;

public class RefuelRequest {
    private int id;
    private double lat;
    private double lng;
    private String carModel;
    private int fuelLevel;
    private String status;
    private String licensePlate; // госномер

    public RefuelRequest(int id, double lat, double lng, String carModel,
                         int fuelLevel, String status, String licensePlate) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.carModel = carModel;
        this.fuelLevel = fuelLevel;
        this.status = status;
        this.licensePlate = licensePlate;
    }

    public int getId() { return id; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getCarModel() { return carModel; }
    public int getFuelLevel() { return fuelLevel; }
    public String getStatus() { return status; }
    public String getLicensePlate() { return licensePlate; }

    // сеттеры (можно оставить пустыми, если не нужны)
    public void setId(int id) { this.id = id; }
    public void setLat(double lat) { this.lat = lat; }
    public void setLng(double lng) { this.lng = lng; }
    public void setCarModel(String carModel) { this.carModel = carModel; }
    public void setFuelLevel(int fuelLevel) { this.fuelLevel = fuelLevel; }
    public void setStatus(String status) { this.status = status; }
    public void setLicensePlate(String licensePlate) { this.licensePlate = licensePlate; }
}
