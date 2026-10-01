package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Manifest;
import com.example.dashboard.store.Store;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.layout.BorderPane;
import javafx.stage.Stage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class Main extends Application {

  @Override
  public void start(Stage stage) throws IOException {
    Path storePath = defaultStorePath();
    Store store = new Store(storePath);
    Path gamesDir = defaultGamesDir();
    List<GameMetadata> games = Manifest.load(gamesDir);
    Profile active = store.getActiveProfile();

    Dashboard dashboard = new Dashboard(store, gamesDir, games, active);

    HomeController home = new HomeController(store, gamesDir, game -> {
    });

    BorderPane root = (BorderPane) home.getRoot();
    stage.setTitle("Game Dashboard");
    stage.setScene(new Scene(root, 1150, 780));
    stage.show();
  }

  private static Path defaultStorePath() {
    String home = System.getProperty("user.home");
    return Path.of(home, ".config", "game-dashboard", "profiles.json");
  }

  private static Path defaultGamesDir() {
    Path local = Path.of("games");
    if (Files.isDirectory(local)) {
      return local.toAbsolutePath();
    }
    String home = System.getProperty("user.home");
    return Path.of(home, ".config", "game-dashboard", "games");
  }
}
