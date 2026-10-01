package com.example.dashboard;

import com.example.dashboard.store.Store;
import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

/** Java side of window.dashboard. Public + JSON strings in/out because WebView's JS bridge needs both. */
public class DashboardBridge {

  private static final Gson GSON = new Gson();

  private final Store store;
  private final String gameId;

  public DashboardBridge(Store store, String gameId) {
    this.store = store;
    this.gameId = gameId;
  }

  public void save(String key, String json) {
    try {
      if (store.getActiveProfile() != null) {
        store.save(gameId, key, JsonParser.parseString(json));
      }
    } catch (JsonParseException | NullPointerException e) {
      // bad input from a game must never crash the launcher
    }
  }

  public String load(String key) {
    Object value = store.load(gameId, key);
    return value == null ? null : GSON.toJson(value);
  }

  public void setScore(double score) {
    if (store.getActiveProfile() != null) {
      store.setScore(gameId, (int) Math.round(score));
    }
  }
}
