package com.example.refuel.bot;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton;
import org.telegram.telegrambots.meta.api.objects.webapp.WebAppInfo;
import java.util.List;

@Component
public class RefuelBot extends TelegramLongPollingBot {

    private final String token;
    private final String botName;
    private final String webAppUrl;

    public RefuelBot(@Value("${telegram.bot.token}") String token,
                     @Value("${telegram.bot.name}") String botName,
                     @Value("${app.webapp.url}") String webAppUrl) {
        this.token = token;
        this.botName = botName;
        this.webAppUrl = webAppUrl;
    }

    @Override
    public String getBotUsername() { return botName; }

    @Override
    public String getBotToken() { return token; }

    @Override
    public void onUpdateReceived(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();
            Long chatId = update.getMessage().getChatId();

            if ("/start".equals(text)) {
                SendMessage msg = new SendMessage();
                msg.setChatId(chatId);
                msg.setText("🚗 Добро пожаловать! Нажмите кнопку, чтобы открыть карту заправок каршеринга Санкт-Петербурга.");

                InlineKeyboardMarkup markup = new InlineKeyboardMarkup();
                InlineKeyboardButton button = new InlineKeyboardButton();
                button.setText("📍 Карта заправок");
                button.setWebApp(new WebAppInfo(webAppUrl));
                markup.setKeyboard(List.of(List.of(button)));
                msg.setReplyMarkup(markup);

                try { execute(msg); } catch (Exception e) { e.printStackTrace(); }
            }
        }
    }
}
