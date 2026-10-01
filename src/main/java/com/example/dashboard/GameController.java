package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Store;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.StackPane;
import javafx.scene.web.WebEngine;
import javafx.scene.web.WebView;
import netscape.javascript.JSObject;

public class GameController {

  private final StackPane root = new StackPane();
  private final DashboardBridge bridge; // strong ref: WebView holds Java objects weakly

  public GameController(Store store, GameMetadata game, Runnable onBack, Runnable onScores) {
    bridge = new DashboardBridge(store, game.getId());
    WebView view = new WebView();
    WebEngine engine = view.getEngine();
    engine.getLoadWorker().stateProperty().addListener((obs, old, state) -> {
      if (state == javafx.concurrent.Worker.State.SUCCEEDED) {
        ((JSObject) engine.executeScript("window")).setMember("runtime", bridge);
        engine.executeScript("window.__dashboardReady && window.__dashboardReady()");
      }
    });
    engine.load(preparedPage(game, bridge.snapshotJson()).toUri().toString());

    Profile p = store.getActiveProfile();
    Button back = new Button("\u2190  Back");
    back.getStyleClass().add("overlay-btn");
    back.setOnAction(e -> onBack.run());
    Button scores = new Button("\u2605 Scores");
    scores.getStyleClass().add("overlay-btn");
    scores.setOnAction(e -> onScores.run());
    Label who = new Label(p == null ? "" : p.getAvatar() + "  " + p.getName());
    who.getStyleClass().add("overlay-name");
    HBox overlay = new HBox(back, who, scores);
    overlay.getStyleClass().add("game-overlay");
    overlay.setAlignment(Pos.CENTER_LEFT);
    overlay.setMaxSize(HBox.USE_PREF_SIZE, HBox.USE_PREF_SIZE);
    StackPane.setAlignment(overlay, Pos.TOP_LEFT);
    root.getStylesheets().add(getClass().getResource("/application.css").toExternalForm());
    Theme.loadFonts();

    root.getChildren().addAll(view, overlay);
  }

  public Node getRoot() {
    return root;
  }

  /** Writes the rewritten page to a temp file; its <base> tag points back at the game's own folder. */
  private static java.nio.file.Path preparedPage(GameMetadata game, String snapshotJson) {
    try {
      java.nio.file.Path entry = game.entryFile().orElseThrow();
      String html = java.nio.file.Files.readString(entry);
      java.nio.file.Path tmp = java.nio.file.Files.createTempFile("game-", ".html");
      tmp.toFile().deleteOnExit();
      java.nio.file.Files.writeString(tmp, GamePage.prepare(html, entry.getParent(), snapshotJson));
      return tmp;
    } catch (java.io.IOException e) {
      throw new java.io.UncheckedIOException(e);
    }
  }
}
