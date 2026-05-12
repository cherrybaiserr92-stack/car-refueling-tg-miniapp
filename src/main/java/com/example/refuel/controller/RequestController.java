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
            new RefuelRequest(1, 59.9350, 30.3300, "Kia Rio", 12, "active", "А123ВС 178"),
            new RefuelRequest(2, 59.9320, 30.3460, "VW Polo", 8, "active", "В456КУ 98"),
            new RefuelRequest(3, 59.9280, 30.3200, "Hyundai Solaris", 25, "in_progress", "Е789НТ 178"),
            new RefuelRequest(4, 59.9400, 30.3100, "Renault Logan", 5, "active", "К012МР 78"),
            new RefuelRequest(5, 59.9260, 30.3550, "Skoda Rapid", 40, "done", "М345СТ 178"),
            new RefuelRequest(6, 59.9210, 30.3700, "Lada Vesta", 60, "done", "О678ХУ 78"),
            new RefuelRequest(7, 59.9420, 30.2950, "Kia Rio", 18, "active", "Р901ТЕ 178"),
            new RefuelRequest(8, 59.9120, 30.3400, "VW Polo", 45, "in_progress", "С234УН 98"),
            new RefuelRequest(9, 59.9500, 30.3200, "Hyundai Solaris", 72, "done", "Т567ФВ 178"),
            new RefuelRequest(10, 59.9370, 30.3050, "Renault Logan", 10, "active", "У890ШГ 78"),
            new RefuelRequest(11, 59.9550, 30.3600, "Skoda Rapid", 35, "in_progress", "Ф123ЩД 178"),
            new RefuelRequest(12, 59.9180, 30.2800, "Lada Vesta", 90, "done", "Х456ЭЮ 78"),
            new RefuelRequest(13, 59.9330, 30.3150, "Kia Rio", 22, "active", "Ц789ЯЯ 178"),
            new RefuelRequest(14, 59.9450, 30.3350, "VW Polo", 55, "in_progress", "Ч012АБ 98"),
            new RefuelRequest(15, 59.9240, 30.2900, "Hyundai Solaris", 5, "active", "Ш345ВГ 178"),
            new RefuelRequest(16, 59.9310, 30.3650, "Renault Logan", 68, "done", "Щ678ДЕ 78"),
            new RefuelRequest(17, 59.9480, 30.3080, "Skoda Rapid", 14, "active", "Э901ЁЖ 178"),
            new RefuelRequest(18, 59.9150, 30.3750, "Lada Vesta", 95, "done", "Ю234ЗИ 78"),
            new RefuelRequest(19, 59.9380, 30.3220, "Kia Rio", 30, "in_progress", "Я567КЛ 178"),
            new RefuelRequest(20, 59.9230, 30.3320, "VW Polo", 42, "in_progress", "А890МН 98"),
            new RefuelRequest(21, 59.9410, 30.3480, "Hyundai Solaris", 17, "active", "В123ОП 178"),
            new RefuelRequest(22, 59.9200, 30.3010, "Renault Logan", 80, "done", "Е456РС 78"),
            new RefuelRequest(23, 59.9470, 30.3570, "Skoda Rapid", 28, "in_progress", "К789ТУ 178"),
            new RefuelRequest(24, 59.9280, 30.3080, "Lada Vesta", 11, "active", "М012ФХ 78"),
            new RefuelRequest(25, 59.9355, 30.3445, "Kia Rio", 63, "done", "О345ЦЧ 178")
        );
    }
}
