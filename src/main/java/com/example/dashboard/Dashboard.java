package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Store;
import java.nio.file.Path;
import java.util.List;

public class Dashboard {

  private final Store store;
  private final Path gamesDir;
  private List<GameMetadata> games;
  private Profile activeProfile;

  public Dashboard(Store store, Path gamesDir, List<GameMetadata> games, Profile activeProfile) {
    this.store = store;
    this.gamesDir = gamesDir;
    this.games = games;
    this.activeProfile = activeProfile;
  }

  public Store getStore() {
    return store;
  }

  public Path getGamesDir() {
    return gamesDir;
  }

  public List<GameMetadata> getGames() {
    return games;
  }

  public Profile getActiveProfile() {
    return activeProfile;
  }

  public void setActiveProfile(Profile profile) {
    this.activeProfile = profile;
  }
}
