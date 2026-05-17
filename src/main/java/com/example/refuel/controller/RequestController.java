package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/api/requests")
    public List<RefuelRequest> getRequests() {
        List<RefuelRequest> list = new ArrayList<>();
        for (int i = 1; i <= 400; i++) {
            double lat = 59.80 + random.nextDouble() * 0.25;
            double lng = 30.10 + random.nextDouble() * 0.50;
            String model = models[random.nextInt(models.length)];
            String status = statuses[random.nextInt(statuses.length)];
            int fuelLevel = random.nextInt(51);
            String licensePlate = generatePlate();
            boolean longRent = random.nextDouble() < 0.2;
            list.add(new RefuelRequest(i, lat, lng, model, fuelLevel, status, licensePlate, longRent));
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
