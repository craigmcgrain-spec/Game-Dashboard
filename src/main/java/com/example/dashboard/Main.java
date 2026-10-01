package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.GamesFolder;
import com.example.dashboard.store.Manifest;
import com.example.dashboard.store.Store;
import javafx.application.Application;
import java.util.function.Consumer;
import javafx.scene.Parent;
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
    List<GameMetadata> games = loadGamesOrEmpty(gamesDir);
    Profile active = store.getActiveProfile();

    Dashboard dashboard = new Dashboard(store, gamesDir, games, active);

    Scene scene = new Scene(new BorderPane(), 1150, 780);
    HomeController[] home = new HomeController[1];
    Consumer<GameMetadata> play = new Consumer<>() {
      @Override
      public void accept(GameMetadata game) {
        GameController gc = new GameController(store, game, () -> scene.setRoot((Parent) home[0].getRoot()),
            () -> showScores(scene, store, games, home[0], this));
        scene.setRoot((Parent) gc.getRoot());
      }
    };
    home[0] = new HomeController(store, gamesDir, play);
    scene.setRoot((Parent) home[0].getRoot());
    stage.setTitle("Game Dashboard");
    stage.setScene(scene);
    stage.show();
  }

  private static Path defaultStorePath() {
    String home = System.getProperty("user.home");
    return Path.of(home, ".config", "game-dashboard", "profiles.json");
  }

  private static List<GameMetadata> loadGamesOrEmpty(Path gamesDir) {
    try {
      return Manifest.load(gamesDir);
    } catch (IOException | RuntimeException e) {
      System.err.println("Could not read games from " + gamesDir + ": " + e.getMessage());
      return List.of();
    }
  }

  private static Path defaultGamesDir() {
    String seed = System.getProperty("games.seed"); // set by the RPM: bundled games are read-only
    if (seed != null) {
      Path userDir = Path.of(System.getProperty("user.home"), ".local", "share", "game-dashboard", "games");
      GamesFolder.seedIfMissing(Path.of(seed), userDir);
      return userDir;
    }
    String override = System.getProperty("games.dir");
    if (override != null) {
      return Path.of(override);
    }
    Path local = Path.of("games");
    if (Files.isDirectory(local)) {
      return local.toAbsolutePath();
    }
    String home = System.getProperty("user.home");
    return Path.of(home, ".config", "game-dashboard", "games");
  }

  private static void showScores(Scene scene, Store store, List<GameMetadata> games, HomeController home,
      Consumer<GameMetadata> play) {
    ProfileDetailController pd = new ProfileDetailController(store.getActiveProfile(), games,
        () -> scene.setRoot((Parent) home.getRoot()), play);
    scene.setRoot((Parent) pd.getRoot());
  }
}
