package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import java.util.List;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public class ProfileDetailController {

  private final VBox root = new VBox(12);

  public ProfileDetailController(Profile profile, List<GameMetadata> games, Runnable onBack, Consumer<GameMetadata> onPlay) {
    root.getStyleClass().add("scores-view");
    Button back = new Button("\u2190 Back");
    back.setOnAction(e -> onBack.run());
    Label title = new Label(profile == null ? "No player" : profile.getAvatar() + " " + profile.getName() + " \u2014 Scores");
    title.getStyleClass().add("scores-title");
    root.getChildren().addAll(back, title);
    for (ScoresModel.Row row : ScoresModel.rows(profile, games)) {
      Label name = new Label(row.title());
      name.getStyleClass().add("profile-name");
      Label score = new Label(row.highScore() == null ? "not played yet" : "Best: " + row.highScore());
      Region spacer = new Region();
      HBox.setHgrow(spacer, Priority.ALWAYS);
      Button play = new Button(row.hasSave() ? "Continue" : "Play");
      play.getStyleClass().add("save-btn");
      play.setOnAction(e -> onPlay.accept(row.game()));
      HBox line = new HBox(14, name, score, spacer, play);
      line.getStyleClass().add("profile-row");
      root.getChildren().add(line);
    }
  }

  public Node getRoot() {
    return root;
  }
}
