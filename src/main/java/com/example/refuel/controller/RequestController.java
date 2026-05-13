package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@RestController
public class RequestController {

    private final Random random = new Random(42); // фиксируем для повторяемости

    private final String[] models = {
        "Kia Rio", "VW Polo", "Hyundai Solaris", "Renault Logan", "Skoda Rapid",
        "Lada Vesta", "Toyota Camry", "BMW 3 Series", "Audi A4", "Mercedes C-Class",
        "Nissan Qashqai", "Mazda 6", "Ford Focus", "Opel Astra", "Peugeot 408",
        "Chery Tiggo", "Haval Jolion", "Geely Coolray", "Kia Ceed", "Hyundai Creta"
    };

    private final String[] statuses = {"active", "in_progress", "done"};

    @GetMapping("/api/requests")
    public List<RefuelRequest> getRequests() {
        return IntStream.rangeClosed(1, 150)
                .mapToObj(i -> {
                    // случайное смещение в пределах города (Питер: 59.75..60.05 с.ш., 30.0..30.7 в.д.)
                    double lat = 59.80 + random.nextDouble() * 0.25;
                    double lng = 30.10 + random.nextDouble() * 0.50;

                    String model = models[random.nextInt(models.length)];
                    String status = statuses[random.nextInt(statuses.length)];
                    int fuelLevel = random.nextInt(101); // 0–100%
                    String licensePlate = String.format("%s%03d%s%s 178",
                        randomLetter(), random.nextInt(1000), randomLetter(), randomLetter());

                    return new RefuelRequest(i, lat, lng, model, fuelLevel, status, licensePlate);
                })
                .collect(Collectors.toList());
    }

    private String randomLetter() {
        char c = (char) ('А' + random.nextInt(26)); // кириллические буквы
        return String.valueOf(c);
    }
}
