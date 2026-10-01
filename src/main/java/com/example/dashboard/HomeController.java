package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.Profile;
import com.example.dashboard.store.Manifest;
import com.example.dashboard.store.Store;
import javafx.fxml.FXMLLoader;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.layout.StackPane;
import javafx.scene.text.Text;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.function.Consumer;

public class HomeController {

  private static final String[] EMOJIS = {
    "🧒", "👧", "👦", "🧑", "👨", "👩", "🐶", "🐱", "🐭", "🦊", "🐻", "⭐", "🚀", "🎮", "⚽", "🎨", "🎵"
  };

  private final BorderPane root;
  private final VBox sidebar;
  private final StackPane content;
  private final Store store;
  private final Path gamesDir;
  private final Consumer<GameMetadata> onGameSelected;

  public HomeController(Store store, Path gamesDir, Consumer<GameMetadata> onGameSelected) throws IOException {
    this.store = store;
    this.gamesDir = gamesDir;
    this.onGameSelected = onGameSelected;
    FXMLLoader loader = new FXMLLoader(getClass().getResource("/view/home.fxml"));
    root = loader.load();
    sidebar = (VBox) loader.getNamespace().get("sidebar");
    content = (StackPane) loader.getNamespace().get("content");
    render();
  }

  public Node getRoot() {
    return root;
  }

  private void render() {
    sidebar.getChildren().clear();
    for (Profile profile : store.listProfiles()) {
      sidebar.getChildren().add(profileRow(profile));
    }
    sidebar.getChildren().add(newProfileButton());
    renderGrid();
  }

  private Node profileRow(Profile profile) {
    HBox row = new HBox(12);
    row.getStyleClass().add("profile-row");
    Label avatar = new Label(profile.getAvatar());
    avatar.getStyleClass().add("profile-avatar");
    Label name = new Label(profile.getName());
    name.getStyleClass().add("profile-name");
    row.getChildren().addAll(avatar, name);
    if (profile.getId().equals(store.getActiveProfile().getId())) {
      row.getStyleClass().add("profile-row-selected");
    }
    row.setOnMouseClicked(event -> {
      store.setActiveProfile(profile.getId());
      render();
    });
    return row;
  }

  private Button newProfileButton() {
    Button button = new Button("＋ New Player");
    button.getStyleClass().add("new-button");
    button.setOnMouseClicked(event -> showNewProfileForm());
    return button;
  }

  private void showNewProfileForm() {
    sidebar.getChildren().clear();
    TextField nameField = new TextField();
    nameField.getStyleClass().add("player-name-field");
    nameField.setPromptText("Player name");

    String[] chosen = {EMOJIS[0]};
    HBox emojiRow = new HBox(8);
    emojiRow.getStyleClass().add("emoji-row");
    for (String emoji : EMOJIS) {
      Button button = new Button(emoji);
      button.getStyleClass().add("emoji-btn");
      button.setOnMouseClicked(event -> chosen[0] = emoji);
      emojiRow.getChildren().add(button);
    }

    HBox actions = new HBox(12);
    actions.getStyleClass().add("form-actions");
    Button save = new Button("Save");
    Button cancel = new Button("Cancel");
    save.getStyleClass().add("save-btn");
    cancel.getStyleClass().add("cancel-btn");
    save.setOnMouseClicked(event -> {
      String name = nameField.getText().trim();
      if (name.isEmpty()) {
        return;
      }
      Profile profile = store.createProfile(name, chosen[0]);
      store.setActiveProfile(profile.getId());
      render();
    });
    cancel.setOnMouseClicked(event -> render());
    actions.getChildren().addAll(save, cancel);

    sidebar.getChildren().addAll(nameField, emojiRow, actions);
  }

  private void renderGrid() {
    List<GameMetadata> games;
    try {
      games = Manifest.load(gamesDir);
    } catch (IOException e) {
      games = List.of();
    }
    if (games.isEmpty()) {
      content.getChildren().clear();
      Label empty = new Label("No games yet. Add a game folder to games/ to get started.");
      empty.getStyleClass().add("empty-state");
      content.getChildren().add(empty);
      return;
    }
    FlowPane grid = new FlowPane(18, 18);
    grid.getStyleClass().add("game-grid");
    for (GameMetadata game : games) {
      grid.getChildren().add(gameCell(game));
    }
    content.getChildren().clear();
    content.getChildren().add(grid);
  }

  private Node gameCell(GameMetadata game) {
    VBox cell = new VBox(8);
    cell.setPrefWidth(140);
    cell.setMaxWidth(140);
    cell.getStyleClass().add("game-cell");
    Node icon = iconNode(game);
    Label title = new Label(game.getTitle());
    title.getStyleClass().add("game-title");
    cell.getChildren().addAll(icon, title);
    cell.setOnMouseClicked(event -> onGameSelected.accept(game));
    return cell;
  }

  private Node iconNode(GameMetadata game) {
    Path iconPath = gamesDir.resolve(game.getIcon());
    if (Files.exists(iconPath)) {
      return new ImageView(new Image(iconPath.toUri().toString()));
    }
    Text text = new Text(game.getIcon());
    text.setStyle("-fx-font-size: 40px");
    return text;
  }
}
