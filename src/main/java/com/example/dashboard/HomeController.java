package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Manifest;
import com.example.dashboard.store.Store;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import javafx.animation.FadeTransition;
import javafx.animation.Interpolator;
import javafx.animation.ParallelTransition;
import javafx.animation.PauseTransition;
import javafx.animation.ScaleTransition;
import javafx.animation.SequentialTransition;
import javafx.fxml.FXMLLoader;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ContentDisplay;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.util.Duration;

public class HomeController {

  private static final String[] EMOJIS = {
    "\uD83E\uDD8A", "\uD83D\uDC3B", "\uD83D\uDC31", "\uD83D\uDC36", "\uD83D\uDC30", "\uD83E\uDD81",
    "\uD83D\uDC38", "\uD83D\uDC3C", "\uD83D\uDC27"
  };
  static final int NAME_LIMIT = 14;

  private final BorderPane root;
  private final VBox sidebar;
  private final VBox content;
  private final Store store;
  private final Path gamesDir;
  private final Consumer<GameMetadata> onGameSelected;
  private final Runnable onScores;
  private boolean animateNextGrid = true;

  public HomeController(Store store, Path gamesDir, Consumer<GameMetadata> onGameSelected, Runnable onScores)
      throws IOException {
    this.store = store;
    this.gamesDir = gamesDir;
    this.onGameSelected = onGameSelected;
    this.onScores = onScores;
    Theme.loadFonts();
    FXMLLoader loader = new FXMLLoader(getClass().getResource("/view/home.fxml"));
    root = loader.load();
    sidebar = (VBox) loader.getNamespace().get("sidebar");
    content = (VBox) loader.getNamespace().get("content");
    render();
  }

  public Node getRoot() {
    return root;
  }

  private void render() {
    sidebar.getChildren().clear();
    Label title = new Label("Who's playing?");
    title.getStyleClass().add("panel-title");
    sidebar.getChildren().add(title);
    for (Profile profile : store.listProfiles()) {
      sidebar.getChildren().add(profileButton(profile));
    }
    sidebar.getChildren().add(newProfileButton());
    renderGrid();
  }

  private Node avatar(Profile profile, double size, boolean selected) {
    int i = StickerPalette.indexFor(profile.getId());
    Label face = new Label(profile.getAvatar());
    face.setMinSize(size, size);
    face.setMaxSize(size, size);
    face.setAlignment(Pos.CENTER);
    face.getStyleClass().add("avatar");
    face.setStyle("-fx-background-color: " + StickerPalette.fill(i) + "; -fx-text-fill: " + StickerPalette.ink(i)
        + "; -fx-font-size: " + Math.round(size * 0.5) + "px; -fx-background-radius: " + size
        + "; -fx-border-radius: " + size + ";");
    StackPane holder = new StackPane(face);
    if (selected) {
      Label check = new Label("\u2713");
      check.getStyleClass().add("check-badge");
      StackPane.setAlignment(check, Pos.BOTTOM_RIGHT);
      holder.getChildren().add(check);
    }
    return holder;
  }

  private Button profileButton(Profile profile) {
    boolean selected = profile.getId().equals(store.getActiveProfile().getId());
    Label name = new Label(profile.getName());
    name.getStyleClass().add("player-name");
    HBox row = new HBox(14, avatar(profile, 64, selected), name);
    row.setAlignment(Pos.CENTER_LEFT);
    Button button = new Button();
    button.setGraphic(row);
    button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
    button.setMaxWidth(Double.MAX_VALUE);
    button.getStyleClass().add("player-btn");
    if (selected) {
      button.getStyleClass().add("player-btn-selected");
    }
    button.setAccessibleText(profile.getName() + (selected ? ", playing now" : ""));
    button.setOnAction(event -> {
      store.setActiveProfile(profile.getId());
      animateNextGrid = false;
      render();
    });
    return button;
  }

  private Button newProfileButton() {
    Label plus = new Label("+");
    plus.getStyleClass().add("plus-badge");
    Label text = new Label("New player");
    text.getStyleClass().add("player-name");
    HBox row = new HBox(14, plus, text);
    row.setAlignment(Pos.CENTER_LEFT);
    Button button = new Button();
    button.setGraphic(row);
    button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
    button.setMaxWidth(Double.MAX_VALUE);
    button.getStyleClass().add("new-btn");
    button.setAccessibleText("New player");
    button.setOnAction(event -> showNewProfileForm());
    return button;
  }

  private void showNewProfileForm() {
    sidebar.getChildren().clear();
    Label title = new Label("New player");
    title.getStyleClass().add("panel-title");

    TextField nameField = new TextField();
    nameField.getStyleClass().add("name-field");
    nameField.setPromptText("Your name");
    nameField.textProperty().addListener((obs, old, now) -> {
      if (now.length() > NAME_LIMIT) {
        nameField.setText(old);
      }
    });

    String[] chosen = {EMOJIS[0]};
    FlowPane picker = new FlowPane(10, 10);
    picker.getStyleClass().add("emoji-grid");
    Button[] buttons = new Button[EMOJIS.length];
    for (int i = 0; i < EMOJIS.length; i++) {
      String emoji = EMOJIS[i];
      Button b = new Button(emoji);
      b.getStyleClass().add("emoji-btn");
      b.setStyle("-fx-background-color: " + StickerPalette.fill(i) + "; -fx-text-fill: " + StickerPalette.ink(i) + ";");
      b.setAccessibleText("Pick " + emoji);
      buttons[i] = b;
      b.setOnAction(event -> {
        chosen[0] = emoji;
        for (Button other : buttons) {
          other.getStyleClass().remove("emoji-btn-selected");
        }
        b.getStyleClass().add("emoji-btn-selected");
      });
      picker.getChildren().add(b);
    }
    buttons[0].getStyleClass().add("emoji-btn-selected");

    Button save = new Button("Let's go!");
    save.getStyleClass().add("go-btn");
    Button cancel = new Button("\u2190  Back");
    cancel.getStyleClass().add("back-btn");
    Runnable submit = () -> {
      String name = nameField.getText().trim();
      if (name.isEmpty()) {
        nameField.setPromptText("Type your name first");
        nameField.requestFocus();
        return;
      }
      Profile profile = store.createProfile(name, chosen[0]);
      store.setActiveProfile(profile.getId());
      animateNextGrid = true;
      render();
    };
    save.setOnAction(event -> submit.run());
    nameField.setOnAction(event -> submit.run());
    cancel.setOnAction(event -> render());
    save.setMaxWidth(Double.MAX_VALUE);
    cancel.setMaxWidth(Double.MAX_VALUE);
    VBox actions = new VBox(8, save, cancel);

    sidebar.getChildren().addAll(title, nameField, picker, actions);
    nameField.requestFocus();
  }

  private void renderGrid() {
    content.getChildren().clear();
    Profile active = store.getActiveProfile();
    if (active == null) {
      content.getChildren().add(message("\u2190  Tap + New player", "Make your own player, then pick a game!"));
      return;
    }

    List<GameMetadata> games;
    String problem = null;
    try {
      games = Manifest.load(gamesDir);
    } catch (IOException | RuntimeException e) {
      games = List.of();
      problem = "Couldn't read the games list: " + e.getMessage();
    }

    Label heading = new Label("Pick a game!");
    heading.getStyleClass().add("page-title");
    heading.setMinWidth(Region.USE_PREF_SIZE);
    Region spacer = new Region();
    HBox.setHgrow(spacer, Priority.ALWAYS);
    Button scores = new Button("\u2605  My scores");
    scores.getStyleClass().add("scores-btn");
    scores.setMinWidth(Region.USE_PREF_SIZE);
    scores.setOnAction(event -> onScores.run());
    HBox header = new HBox(heading, spacer, scores);
    header.setAlignment(Pos.CENTER_LEFT);
    content.getChildren().add(header);

    if (games.isEmpty()) {
      content.getChildren().add(message(problem != null ? "Hmm, no games" : "No games yet",
          problem != null ? problem : "Ask a grown-up to add a game folder."));
      return;
    }

    Map<String, ScoresModel.Row> byId = new HashMap<>();
    for (ScoresModel.Row row : ScoresModel.rows(active, games)) {
      byId.put(row.game().getId(), row);
    }
    FlowPane grid = new FlowPane(30, 34);
    grid.getStyleClass().add("game-grid");
    int n = 0;
    for (GameMetadata game : games) {
      grid.getChildren().add(gameSticker(game, n++, byId.get(game.getId())));
    }
    content.getChildren().add(grid);
    if (animateNextGrid) {
      popIn(grid);
    }
    animateNextGrid = false;
  }

  private Node message(String big, String small) {
    Label a = new Label(big);
    a.getStyleClass().add("empty-title");
    Label b = new Label(small);
    b.getStyleClass().add("empty-text");
    b.setWrapText(true);
    VBox box = new VBox(10, a, b);
    box.getStyleClass().add("empty-sticker");
    box.setMaxWidth(520);
    box.setRotate(-1.5);
    return box;
  }

  private Button gameSticker(GameMetadata game, int index, ScoresModel.Row row) {
    Node icon = iconNode(game, StickerPalette.ink(index));
    StackPane iconBox = new StackPane(icon);
    iconBox.setMinHeight(120);

    Label title = new Label(game.getTitle());
    title.getStyleClass().add("sticker-label");
    title.setMaxWidth(Double.MAX_VALUE);
    title.setAlignment(Pos.CENTER);
    VBox face = new VBox(10, iconBox, title);
    face.setAlignment(Pos.CENTER);

    StackPane stack = new StackPane(face);
    if (row != null && row.highScore() != null) {
      Label badge = new Label("\u2605 " + row.highScore());
      badge.getStyleClass().add("score-badge");
      StackPane.setAlignment(badge, Pos.TOP_RIGHT);
      stack.getChildren().add(badge);
    }

    Button button = new Button();
    button.setGraphic(stack);
    button.setContentDisplay(ContentDisplay.GRAPHIC_ONLY);
    button.getStyleClass().add("sticker");
    button.setStyle("-fx-background-color: " + StickerPalette.fill(index) + ";");
    button.setRotate(new double[] {-2.2, 1.6, -1.2, 2.0, -1.8, 1.2}[index % 6]);
    button.setAccessibleText("Play " + game.getTitle()
        + (row != null && row.highScore() != null ? ", best score " + row.highScore() : ""));
    button.setOnAction(event -> onGameSelected.accept(game));
    return button;
  }

  private Node iconNode(GameMetadata game, String ink) {
    var iconPath = Manifest.inside(gamesDir, game.getIcon()).filter(Files::isRegularFile);
    if (iconPath.isPresent()) {
      ImageView view = new ImageView(new Image(iconPath.get().toUri().toString(), 112, 112, true, true));
      return view;
    }
    Text text = new Text(game.getIcon());
    text.getStyleClass().add("sticker-glyph");
    text.setStyle("-fx-fill: " + ink + ";");
    return text;
  }

  /** The one authored motion: stickers get slapped onto the page, one after another. */
  private static void popIn(FlowPane grid) {
    int i = 0;
    for (Node sticker : grid.getChildren()) {
      sticker.setOpacity(0);
      ScaleTransition scale = new ScaleTransition(Duration.millis(260), sticker);
      scale.setFromX(0.55);
      scale.setFromY(0.55);
      scale.setToX(1);
      scale.setToY(1);
      scale.setInterpolator(Interpolator.SPLINE(0.16, 1.0, 0.3, 1.0));
      FadeTransition fade = new FadeTransition(Duration.millis(140), sticker);
      fade.setToValue(1);
      PauseTransition wait = new PauseTransition(Duration.millis(70L * i++));
      new SequentialTransition(wait, new ParallelTransition(scale, fade)).play();
    }
  }
}
