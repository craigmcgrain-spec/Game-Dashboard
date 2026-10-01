package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

public class ProfileDetailController {

  private final ScrollPane root = new ScrollPane();
  private final Consumer<GameMetadata> onPlay;

  public ProfileDetailController(Profile profile, List<GameMetadata> games, Runnable onBack, Consumer<GameMetadata> onPlay) {
    this.onPlay = onPlay;
    Theme.loadFonts();
    VBox box = new VBox();
    box.getStyleClass().add("scores-box");

    Button back = new Button("\u2190  Back");
    back.getStyleClass().add("back-btn");
    back.setOnAction(e -> onBack.run());
    Label title = new Label(profile == null ? "No player yet" : profile.getName() + "'s scores");
    title.getStyleClass().add("page-title");
    HBox header = new HBox(24, back, title);
    header.setAlignment(Pos.CENTER_LEFT);
    box.getChildren().add(header);

    int i = 0;
    for (ScoresModel.Row row : ScoresModel.rows(profile, games)) {
      box.getChildren().add(scoreRow(row, i++));
    }

    root.setContent(box);
    root.setFitToWidth(true);
    root.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    root.getStyleClass().add("page-scroll");
    root.getStylesheets().add(getClass().getResource("/application.css").toExternalForm());
  }

  private Node scoreRow(ScoresModel.Row row, int index) {
    String icon = row.game().getIcon();
    boolean glyph = icon.codePointCount(0, icon.length()) <= 3;
    Label tile = new Label(glyph ? icon : row.title().substring(0, 1).toUpperCase());
    tile.getStyleClass().add("score-tile");
    tile.setStyle("-fx-text-fill: " + StickerPalette.ink(index) + ";");

    Label name = new Label(row.title());
    name.getStyleClass().add("score-name");
    Label score = new Label(row.highScore() == null ? "Not played yet" : "\u2605 Best: " + row.highScore());
    score.getStyleClass().add(row.highScore() == null ? "score-none" : "score-value");
    VBox text = new VBox(6, name, score);
    text.setAlignment(Pos.CENTER_LEFT);

    Region spacer = new Region();
    HBox.setHgrow(spacer, Priority.ALWAYS);
    Button play = new Button(row.hasSave() ? "Continue" : "Play");
    play.getStyleClass().add("row-go");
    play.setAccessibleText((row.hasSave() ? "Continue " : "Play ") + row.title());
    play.setOnAction(e -> onPlay.accept(row.game()));
    HBox line = new HBox(tile, text, spacer, play);
    line.setAlignment(Pos.CENTER_LEFT);
    line.getStyleClass().add("score-row");
    line.setStyle("-fx-background-color: " + StickerPalette.fill(index) + ";");
    line.setRotate(new double[] {-0.9, 0.8, -0.6, 0.9}[index % 4]);
    return line;
  }

  public Node getRoot() {
    return root;
  }
}
