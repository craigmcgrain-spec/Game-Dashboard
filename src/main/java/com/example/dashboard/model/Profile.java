package com.example.dashboard.model;

import java.util.LinkedHashMap;
import java.util.Map;

public class Profile {

  private String id;
  private String name;
  private String avatar;
  private final Map<String, GameRecord> games = new LinkedHashMap<>();

  Profile() {
  }

  public Profile(String id, String name, String avatar) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
  }

  public GameRecord gameRecord(String gameId) {
    return games.computeIfAbsent(gameId, gid -> new GameRecord());
  }

  public GameRecord getGameIfPresent(String gameId) {
    return games.get(gameId);
  }

  public String getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getAvatar() {
    return avatar;
  }

  public Map<String, GameRecord> getGames() {
    return games;
  }
}
