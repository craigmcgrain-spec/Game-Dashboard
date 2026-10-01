package com.example.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.store.Manifest;
import com.example.dashboard.store.Store;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ScoresModelTest {

  Store store;
  List<GameMetadata> games;

  @BeforeEach
  void setup() throws IOException {
    Path dir = Files.createTempDirectory("scores");
    for (String id : new String[] {"a", "b"}) {
      Files.createDirectories(dir.resolve(id));
      Files.writeString(dir.resolve(id + "/index.html"), "x");
    }
    Files.writeString(dir.resolve("manifest.json"),
        "[{\"id\":\"a\",\"title\":\"A\",\"icon\":\"1\",\"entry\":\"a/index.html\"},"
            + "{\"id\":\"b\",\"title\":\"B\",\"icon\":\"2\",\"entry\":\"b/index.html\"}]");
    games = Manifest.load(dir);
    store = new Store(dir.resolve("p.json"));
    store.createProfile("Alex", "x");
  }

  @Test
  void unplayedGameShowsNoScoreAndNoSave() {
    ScoresModel.Row r = ScoresModel.rows(store.getActiveProfile(), games).get(0);
    assertThat(r.title()).isEqualTo("A");
    assertThat(r.highScore()).isNull();
    assertThat(r.hasSave()).isFalse();
  }

  @Test
  void playedGameShowsScoreDateAndSave() {
    store.setScore("b", 700);
    store.save("b", "state", "lvl2");
    ScoresModel.Row r = ScoresModel.rows(store.getActiveProfile(), games).get(1);
    assertThat(r.highScore()).isEqualTo(700L);
    assertThat(r.playedAt()).isNotNull();
    assertThat(r.hasSave()).isTrue();
  }

  @Test
  void scoreAloneIsNotASavedGame() {
    store.setScore("a", 10);
    assertThat(ScoresModel.rows(store.getActiveProfile(), games).get(0).hasSave()).isFalse();
  }

  @Test
  void nullProfileYieldsNoRows() {
    assertThat(ScoresModel.rows(null, games)).isEmpty();
  }
}
