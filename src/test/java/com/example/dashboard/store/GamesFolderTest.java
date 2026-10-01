package com.example.dashboard.store;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class GamesFolderTest {

  @Test
  void seedCopiesTheBundledGamesIntoAnEmptyUserFolder() throws IOException {
    Path seed = Files.createTempDirectory("seed");
    Files.createDirectories(seed.resolve("g"));
    Files.writeString(seed.resolve("g/index.html"), "x");
    Files.writeString(seed.resolve("manifest.json"), "[]");
    Path user = Files.createTempDirectory("user").resolve("games");
    GamesFolder.seedIfMissing(seed, user);
    assertThat(user.resolve("g/index.html")).exists();
    assertThat(user.resolve("manifest.json")).exists();
  }

  @Test
  void seedNeverOverwritesAnExistingUserManifest() throws IOException {
    Path seed = Files.createTempDirectory("seed2");
    Files.writeString(seed.resolve("manifest.json"), "[]");
    Path user = Files.createTempDirectory("user2");
    Files.writeString(user.resolve("manifest.json"), "MINE");
    GamesFolder.seedIfMissing(seed, user);
    assertThat(Files.readString(user.resolve("manifest.json"))).isEqualTo("MINE");
  }

  @Test
  void missingSeedFolderIsIgnored() throws IOException {
    Path user = Files.createTempDirectory("user3");
    GamesFolder.seedIfMissing(user.resolve("nope"), user.resolve("games"));
    assertThat(user.resolve("games")).doesNotExist();
  }
}
