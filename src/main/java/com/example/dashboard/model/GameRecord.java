package com.example.dashboard.model;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

public class GameRecord {

  private final Map<String, JsonElement> saves = new LinkedHashMap<>();
  private String playedAt;

  GameRecord() {
  }

  public void putSave(String key, JsonElement value) {
    saves.put(key, value);
  }

  public void recordScore(int score) {
    if (playedAt == null) {
      playedAt = LocalDate.now().toString();
    }
    JsonElement current = saves.get("highScore");
    long currentScore = Long.MIN_VALUE;
    if (current != null && current.isJsonPrimitive()) {
      JsonPrimitive p = current.getAsJsonPrimitive();
      if (p.isNumber()) {
        currentScore = p.getAsNumber().longValue();
      }
    }
    if (score > currentScore) {
      saves.put("highScore", new JsonPrimitive((long) score));
    }
  }

  public Object load(String key) {
    JsonElement element = saves.get(key);
    if (element == null || element.isJsonNull()) {
      return null;
    }
    return asJava(element);
  }

  /** True if the game stored any continue-state (the high score alone doesn't count). */
  public boolean hasSave() {
    return saves.keySet().stream().anyMatch(k -> !k.equals("highScore"));
  }

  /** Copy of everything stored for this game (saves + highScore), for handing to the page. */
  public com.google.gson.JsonObject toJsonObject() {
    com.google.gson.JsonObject o = new com.google.gson.JsonObject();
    saves.forEach((k, v) -> o.add(k, v.deepCopy()));
    return o;
  }

  public String getPlayedAt() {
    return playedAt;
  }

  private static Object asJava(JsonElement element) {
    if (!element.isJsonPrimitive()) {
      return element;
    }
    JsonPrimitive primitive = element.getAsJsonPrimitive();
    if (primitive.isBoolean()) {
      return primitive.getAsBoolean();
    }
    if (primitive.isString()) {
      return primitive.getAsString();
    }
    if (primitive.isNumber()) {
      BigDecimal value = new BigDecimal(primitive.getAsNumber().toString());
      if (value.scale() <= 0) {
        return value.longValue();
      }
      return value.doubleValue();
    }
    return element;
  }
}
