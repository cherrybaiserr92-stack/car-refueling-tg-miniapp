package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.awt.geom.Path2D;
import java.awt.geom.Point2D;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@RestController
public class RequestController {

    private final Random random = new Random(42);
    private final String[] models = {
        "Kia Rio", "VW Polo", "Hyundai Solaris", "Renault Logan", "Skoda Rapid",
        "Lada Vesta", "Toyota Camry", "BMW 3 Series", "Audi A4", "Mercedes C-Class",
        "Nissan Qashqai", "Mazda 6", "Ford Focus", "Opel Astra", "Peugeot 408",
        "Chery Tiggo", "Haval Jolion", "Geely Coolray", "Kia Ceed", "Hyundai Creta",
        "BMW E34", "BMW E39", "Lada Niva", "VAZ 2106", "Ferrari F40", "Lamborghini Diablo",
        "Volga GAZ-21", "KamAZ 65115", "UAZ Patriot", "GAZ Sobol"
    };
    private final String[] statuses = {"active", "in_progress", "done"};
    private final char[] allowedLetters = {'А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'};

    // Полигон Финского залива и Невской губы (приблизительный)
    private final Path2D waterPolygon = new Path2D.Double();
    {
        // Координаты полигона (широта, долгота) – грубая область воды
        waterPolygon.moveTo(59.87, 30.15);
        waterPolygon.lineTo(60.05, 30.15);
        waterPolygon.lineTo(60.05, 30.55);
        waterPolygon.lineTo(59.87, 30.55);
        waterPolygon.closePath();
        // Также река Нева (приблизительно)
        // Добавим исключение узкой полосы вдоль русла
        // Для простоты можно исключить точки, попадающие в этот большой прямоугольник (большая вода)
    }

    private boolean isOnWater(double lat, double lng) {
        // Проверяем, не попали ли в область воды
        return waterPolygon.contains(new Point2D.Double(lat, lng));
    }

    @GetMapping("/api/requests")
    public List<RefuelRequest> getRequests() {
        List<RefuelRequest> list = new ArrayList<>();
        int count = 0;
        while (list.size() < 400 && count < 2000) {  // ограничим число попыток
            double lat = 59.80 + random.nextDouble() * 0.25;
            double lng = 30.10 + random.nextDouble() * 0.50;
            if (!isOnWater(lat, lng)) {
                String model = models[random.nextInt(models.length)];
                String status = statuses[random.nextInt(statuses.length)];
                int fuelLevel = random.nextInt(51);
                String licensePlate = generatePlate();
                list.add(new RefuelRequest(list.size()+1, lat, lng, model, fuelLevel, status, licensePlate));
            }
            count++;
        }
        return list;
    }

    private String generatePlate() {
        char l1 = allowedLetters[random.nextInt(allowedLetters.length)];
        char l2 = allowedLetters[random.nextInt(allowedLetters.length)];
        char l3 = allowedLetters[random.nextInt(allowedLetters.length)];
        int digits = random.nextInt(1000);
        return String.format("%c%03d%c%c 178", l1, digits, l2, l3);
    }
}
