package com.example.refuel.controller;

import com.example.refuel.model.RefuelRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
public class RequestController {
    @GetMapping("/api/requests")
    public List<RefuelRequest> getRequests() {
        return List.of(
            new RefuelRequest(1, 59.9350, 30.3300, "Kia Rio X-Line", 12, "active",
                    "Невский пр., 80"),
            new RefuelRequest(2, 59.9320, 30.3460, "Volkswagen Polo", 8, "active",
                    "Литейный пр., 15"),
            new RefuelRequest(3, 59.9280, 30.3200, "Hyundai Solaris", 25, "in_progress",
                    "ул. Марата, 10"),
            new RefuelRequest(4, 59.9400, 30.3100, "Renault Logan", 5, "active",
                    "Петроградская наб., 22"),
            new RefuelRequest(5, 59.9260, 30.3550, "Skoda Rapid", 40, "done",
                    "Загородный пр., 45")
        );
    }
}
