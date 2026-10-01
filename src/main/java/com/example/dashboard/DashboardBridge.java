package com.example.dashboard;

import com.example.dashboard.model.GameRecord;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Store;
import com.google.gson.Gson;
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
    if ("highScore".equals(key)) {
      return; // reserved: only setScore may change it
    }
    try {
      if (store.getActiveProfile() != null) {
        store.save(gameId, key, JsonParser.parseString(json));
      }
    } catch (RuntimeException e) {
      // bad input or a failed disk write must never crash the launcher or throw into the game
    }
  }

  /** Everything saved for this game by the active player, as a JSON object (for the page's initial data). */
  public String snapshotJson() {
    Profile p = store.getActiveProfile();
    GameRecord r = p == null ? null : p.getGameIfPresent(gameId);
    return r == null ? "{}" : GSON.toJson(r.toJsonObject());
  }

  public String load(String key) {
    Object value = store.load(gameId, key);
    return value == null ? null : GSON.toJson(value);
  }

  public void setScore(double score) {
    try {
      if (store.getActiveProfile() != null && Double.isFinite(score)) {
        store.setScore(gameId, (int) Math.round(score));
      }
    } catch (RuntimeException e) {
      // see save()
    }
  }
}
