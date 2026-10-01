package com.example.dashboard.store;

import com.example.dashboard.model.Profile;
import com.google.gson.JsonElement;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StoreTest {

  Path dir;
  Path store;

  @BeforeEach
  void setup() throws IOException {
    dir = Files.createTempDirectory("store-test");
    store = dir.resolve("profiles.json");
  }

  @Test
  void createProfileAssignsUniqueSlugId() {
    try (Store s = new Store(store)) {
      Profile a = s.createProfile("Alex", "🧒");
      Profile b = s.createProfile("Sam", "👧");
      assertThat(a.getId()).matches("[a-z0-9-]+");
      assertThat(a.getId()).isNotEqualTo(b.getId());
      assertThat(s.listProfiles()).hasSize(2);
    }
  }

  @Test
  void createProfileGeneratesUniqueIdOnCollision() {
    try (Store s = new Store(store)) {
      Profile a = s.createProfile("Alex", "🧒");
      Profile b = s.createProfile("Alex", "👧"); // same name -> different id
      assertThat(a.getId()).isNotEqualTo(b.getId());
    }
  }

  @Test
  void scoreIsMaximumAndPersistsAcrossInstances() throws IOException {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
      s.setScore("rocket-run", 500);
    }
    try (Store s = new Store(store)) { // new instance, simulates restart
      assertThat(s.load("rocket-run", "highScore")).isEqualTo(500L);
      s.setScore("rocket-run", 1200);
      s.setScore("rocket-run", 900); // lower, ignored
    }
    try (Store s = new Store(store)) {
      assertThat(s.load("rocket-run", "highScore")).isEqualTo(1200L);
    }
  }

  @Test
  void saveAndLoadAreScopedPerProfileAndKey() {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
      s.createProfile("Sam", "👧");
      s.save("rocket-run", "save", "level:3");
      assertThat(s.load("rocket-run", "save")).isEqualTo("level:3");
      // different profile does not see Alex's save
      s.setActiveProfile(s.getProfile("sam").getId());
      assertThat(s.load("rocket-run", "save")).isNull();
    }
  }

  @Test
  void writeIsAtomic() throws IOException {
    try (Store s = new Store(store)) {
      s.createProfile("Alex", "🧒");
    }
    // store exists and parses as valid JSON after a clean write
    assertThat(Json.parse(Files.readString(store))).isNotNull();
  }

  @Test
  void corruptStoreFileIsSetAsideAndAppStartsEmpty() throws IOException {
    Files.writeString(store, "{not json");
    try (Store s = new Store(store)) {
      assertThat(s.listProfiles()).isEmpty();
      s.createProfile("Alex", "x"); // and it is usable again
    }
    try (java.util.stream.Stream<Path> files = Files.list(dir)) {
      assertThat(files.map(f -> f.getFileName().toString()))
          .anyMatch(n -> n.startsWith("profiles.json.corrupt-"));
    }
    try (Store s = new Store(store)) {
      assertThat(s.listProfiles()).hasSize(1);
    }
  }

  @Test
  void failedWriteLeavesNoTempFilesBehind() throws IOException {
    Store s = new Store(store);
    s.createProfile("Alex", "x");
    dir.toFile().setWritable(false);
    try {
      org.assertj.core.api.Assertions.assertThatThrownBy(() -> s.createProfile("Sam", "y"))
          .isInstanceOf(java.io.UncheckedIOException.class);
    } finally {
      dir.toFile().setWritable(true);
    }
    try (java.util.stream.Stream<Path> files = Files.list(dir)) {
      assertThat(files.map(f -> f.getFileName().toString())).noneMatch(n -> n.endsWith(".tmp"));
    }
  }
}
