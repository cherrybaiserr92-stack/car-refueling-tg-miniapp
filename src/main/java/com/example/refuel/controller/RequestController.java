package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@RestController
public class RequestController {

    private final Random random = new Random(42);

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
                    double lat = 59.80 + random.nextDouble() * 0.25;
                    double lng = 30.10 + random.nextDouble() * 0.50;
                    String model = models[random.nextInt(models.length)];
                    String status = statuses[random.nextInt(statuses.length)];
                    int fuelLevel = random.nextInt(101);
                    String licensePlate = String.format("%s%03d%s%s 178",
                        randomLetter(), random.nextInt(1000), randomLetter(), randomLetter());
                    return new RefuelRequest(i, lat, lng, model, fuelLevel, status, licensePlate);
                })
                .collect(Collectors.toList());
    }

    private String randomLetter() {
        char c = (char) ('А' + random.nextInt(26));
        return String.valueOf(c);
    }

    @GetMapping("/api/estimate")
    public EstimateResponse estimate(@RequestParam double lat, @RequestParam double lng) {
        try {
            RestTemplate restTemplate = new RestTemplate();
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
