package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Store;
import javafx.concurrent.Worker;
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

  // Defines window.dashboard on top of window.runtime (the Java DashboardBridge).
  private static final String SHIM = """
      window.dashboard = {
        save: function(k, v) { runtime.save(String(k), JSON.stringify(v)); },
        load: function(k) { var r = runtime.load(String(k)); return (r === null || r === undefined) ? undefined : JSON.parse(r); },
        setScore: function(s) { runtime.setScore(Number(s)); }
      };
      """;

  private final StackPane root = new StackPane();
  private final DashboardBridge bridge; // strong ref: WebView holds Java objects weakly

  public GameController(Store store, GameMetadata game, Runnable onBack, Runnable onScores) {
    bridge = new DashboardBridge(store, game.getId());
    WebView view = new WebView();
    WebEngine engine = view.getEngine();
    engine.getLoadWorker().stateProperty().addListener((obs, old, state) -> {
      if (state == Worker.State.SUCCEEDED) {
        ((JSObject) engine.executeScript("window")).setMember("runtime", bridge);
        engine.executeScript(SHIM);
      }
    });
    engine.load(game.entryFile().orElseThrow().toUri().toString());

    Profile p = store.getActiveProfile();
    Label who = new Label(p == null ? "" : p.getAvatar() + " " + p.getName());
    who.getStyleClass().add("overlay-label");
    Button back = new Button("\u2190 Back");
    back.setOnAction(e -> onBack.run());
    Button scores = new Button("Scores");
    scores.setOnAction(e -> onScores.run());
    HBox overlay = new HBox(10, back, who, scores);
    overlay.getStyleClass().add("game-overlay");
    overlay.setAlignment(Pos.CENTER_LEFT);
    overlay.setMaxSize(HBox.USE_PREF_SIZE, HBox.USE_PREF_SIZE);
    StackPane.setAlignment(overlay, Pos.TOP_LEFT);

    root.getChildren().addAll(view, overlay);
  }

  public Node getRoot() {
    return root;
  }
}
