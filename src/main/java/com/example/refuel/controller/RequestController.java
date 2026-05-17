package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@RestController
public class RequestController {

    private final Random random = new Random(42);

    // Модели машин
    private final String[] models = {
        "Kia Rio", "VW Polo", "Hyundai Solaris", "Renault Logan", "Skoda Rapid",
        "Lada Vesta", "Toyota Camry", "BMW 3 Series", "Audi A4", "Mercedes C-Class",
        "Nissan Qashqai", "Mazda 6", "Ford Focus", "Opel Astra", "Peugeot 408",
        "Chery Tiggo", "Haval Jolion", "Geely Coolray", "Kia Ceed", "Hyundai Creta"
    };

    // Статусы
    private final String[] statuses = {"active", "in_progress", "done"};

    // Допустимые буквы для госномеров (только те, что используются в РФ)
    private final char[] allowedLetters = {'А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'};

    @GetMapping("/api/requests")
    public List<RefuelRequest> getRequests() {
        List<RefuelRequest> list = new ArrayList<>();
        for (int i = 1; i <= 150; i++) {
            double lat = 59.80 + random.nextDouble() * 0.25;
            double lng = 30.10 + random.nextDouble() * 0.50;
            String model = models[random.nextInt(models.length)];
            String status = statuses[random.nextInt(statuses.length)];
            // Топливо не больше 50%
            int fuelLevel = random.nextInt(51); // 0..50
            String licensePlate = generatePlate();
            list.add(new RefuelRequest(i, lat, lng, model, fuelLevel, status, licensePlate));
        }
        return list;
    }

    private String generatePlate() {
        char letter1 = allowedLetters[random.nextInt(allowedLetters.length)];
        char letter2 = allowedLetters[random.nextInt(allowedLetters.length)];
        char letter3 = allowedLetters[random.nextInt(allowedLetters.length)];
        int digits = random.nextInt(1000);
        return String.format("%c%03d%c%c 178", letter1, digits, letter2, letter3);
    }

    @GetMapping("/api/estimate")
    public EstimateResponse estimate(@RequestParam double lat, @RequestParam double lng) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            // Российский сервер Overpass
            String overpassUrl = "https://overpass.openstreetmap.ru/api/interpreter?data=" +
                java.net.URLEncoder.encode(
                    "[out:json];(way[\"building\"](around:50," + lat + "," + lng + ");node[\"amenity\"=\"parking\"](around:50," + lat + "," + lng + ");way[\"highway\"](around:50," + lat + "," + lng + "););out center;",
                    "UTF-8"
                );
            String response = restTemplate.getForObject(overpassUrl, String.class);
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(response);
            int buildings = 0;
            int parkings = 0;
            int narrowRoads = 0;
            for (JsonNode el : root.get("elements")) {
                JsonNode tags = el.get("tags");
                if (tags != null) {
                    if (tags.has("building")) buildings++;
                    if ("parking".equals(tags.has("amenity") ? tags.get("amenity").asText() : "")) parkings++;
                    if ("residential".equals(tags.has("highway") ? tags.get("highway").asText() : "") &&
                        "1".equals(tags.has("lanes") ? tags.get("lanes").asText() : "")) narrowRoads++;
                }
            }
            int score = 0;
            StringBuilder text = new StringBuilder();
            if (buildings > 5) {
                score += 3;
                text.append("Плотная застройка. ");
            }
            if (parkings == 0) {
                score += 3;
                text.append("Нет парковки рядом. ");
            }
            if (narrowRoads > 0) {
                score += 2;
                text.append("Узкие проезды. ");
            }
            if (score == 0) {
                text.append("Свободно, парковка есть.");
            }
            score = Math.min(10, score);
            return new EstimateResponse(score, text.toString().trim());
        } catch (Exception e) {
            e.printStackTrace();
            return new EstimateResponse(-1, "Ошибка оценки");
        }
    }

    static class EstimateResponse {
        public int score;
        public String text;
        public EstimateResponse(int score, String text) {
            this.score = score;
            this.text = text;
        }
    }
}
