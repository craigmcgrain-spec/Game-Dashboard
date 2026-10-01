package com.example.dashboard.store;

import com.example.dashboard.model.GameMetadata;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ManifestTest {

  Path games;

  @BeforeEach
  void setup() throws IOException {
    games = Files.createTempDirectory("games");
  }

  @Test
  void loadsValidEntriesAndResolvesPaths() throws IOException {
    Files.createDirectories(games.resolve("rocket-run"));
    Files.writeString(games.resolve("rocket-run/index.html"), "<!doctype html>");
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"rocket-run","title":"Rocket Run","icon":"🚀","entry":"rocket-run/index.html","minAge":6}]
      """);
    List<GameMetadata> games_ = Manifest.load(games);
    assertThat(games_).hasSize(1);
    GameMetadata m = games_.get(0);
    assertThat(m.getId()).isEqualTo("rocket-run");
    assertThat(m.getMinAge()).isEqualTo(6);
    assertThat(m.entryFile()).get().toString().endsWith("rocket-run/index.html");
  }

  @Test
  void testSkipsMissingEntry() throws IOException {
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"ghost","title":"Ghost","icon":"👻","entry":"missing/index.html"}]
      """);
    List<GameMetadata> games_ = Manifest.load(games);
    assertThat(games_).isEmpty(); // entry file absent -> skipped, not thrown
  }

  @Test
  void rejectsDuplicateIds() throws IOException {
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"a","title":"A","icon":"🎮","entry":"a/index.html"},
       {"id":"a","title":"B","icon":"🎮","entry":"b/index.html"}]
      """);
    assertThatThrownBy(() -> Manifest.load(games)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void malformedJsonIsAnIllegalArgumentNotAGsonCrash() throws IOException {
    Files.writeString(games.resolve("manifest.json"), "[{oops");
    assertThatThrownBy(() -> Manifest.load(games)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void entryWithoutPathAndNullFieldsAreSkippedOrDefaultedNotCrashed() throws IOException {
    Files.createDirectories(games.resolve("ok"));
    Files.writeString(games.resolve("ok/index.html"), "x");
    Files.writeString(games.resolve("manifest.json"), """
      [{"id":"noentry","title":"T","icon":"i"},
       {"id":"ok","entry":"ok/index.html"}]
      """);
    List<GameMetadata> g = Manifest.load(games);
    assertThat(g).hasSize(1);
    assertThat(g.get(0).getTitle()).isEqualTo("ok"); // missing title falls back to the id
    assertThat(g.get(0).getIcon()).isNotBlank();
  }

  @Test
  void entryOutsideTheGamesFolderIsSkipped() throws IOException {
    Path outside = Files.createTempDirectory("outside");
    Files.writeString(outside.resolve("index.html"), "x");
    String rel = games.relativize(outside).toString().replace('\\', '/') + "/index.html";
    Files.writeString(games.resolve("manifest.json"),
        "[{\"id\":\"evil\",\"title\":\"E\",\"icon\":\"e\",\"entry\":\"" + rel + "\"}]");
    assertThat(Manifest.load(games)).isEmpty();
  }

  @Test
  void unusablePathCharactersAreSkippedNotCrashed() throws IOException {
    Files.writeString(games.resolve("manifest.json"),
        "[{\"id\":\"nul\",\"title\":\"N\",\"icon\":\"n\",\"entry\":\"a\\u0000b/index.html\"}]");
    assertThat(Manifest.load(games)).isEmpty();
  }

  @Test
  void insideRejectsTraversalAndAbsolutePaths() {
    assertThat(Manifest.inside(games, "a/b.png")).isPresent();
    assertThat(Manifest.inside(games, "../x.png")).isEmpty();
    assertThat(Manifest.inside(games, "/etc/passwd")).isEmpty();
    assertThat(Manifest.inside(games, "\uD83D\uDE80")).isPresent(); // an emoji icon is a harmless relative name
  }
}
