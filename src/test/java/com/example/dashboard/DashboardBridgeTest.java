package com.example.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.dashboard.store.Store;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DashboardBridgeTest {

  Store store;

  @BeforeEach
  void setup() throws IOException {
    store = new Store(Files.createTempDirectory("bridge").resolve("profiles.json"));
    store.createProfile("Alex", "x");
  }

  @Test
  void saveThenLoadRoundTripsJson() {
    DashboardBridge b = new DashboardBridge(store, "rocket-run");
    b.save("state", "{\"level\":3,\"name\":\"a\"}");
    assertThat(b.load("state")).isEqualTo("{\"level\":3,\"name\":\"a\"}");
  }

  @Test
  void loadMissingKeyIsNull() {
    assertThat(new DashboardBridge(store, "rocket-run").load("nope")).isNull();
  }

  @Test
  void setScoreKeepsMaximumAndIsLoadableAsHighScore() {
    DashboardBridge b = new DashboardBridge(store, "rocket-run");
    b.setScore(1200);
    b.setScore(900.0);
    assertThat(b.load("highScore")).isEqualTo("1200");
  }

  @Test
  void malformedJsonIsRejectedWithoutThrowing() {
    DashboardBridge b = new DashboardBridge(store, "rocket-run");
    b.save("k", "{not json");
    assertThat(b.load("k")).isNull();
  }

  @Test
  void noActiveProfileIsANoOpNotACrash() throws IOException {
    Store empty = new Store(Files.createTempDirectory("bridge2").resolve("p.json"));
    DashboardBridge b = new DashboardBridge(empty, "g");
    b.save("k", "1");
    b.setScore(5);
    assertThat(b.load("k")).isNull();
  }

  @Test
  void snapshotHoldsEverythingSavedForThisGameOnly() {
    DashboardBridge b = new DashboardBridge(store, "rocket-run");
    b.save("state", "{\"l\":1}");
    b.setScore(30);
    new DashboardBridge(store, "other").save("x", "1");
    assertThat(com.google.gson.JsonParser.parseString(b.snapshotJson()).getAsJsonObject().keySet())
        .containsExactlyInAnyOrder("state", "highScore");
  }

  @Test
  void emptySnapshotWhenNothingSavedOrNoProfile() throws IOException {
    assertThat(new DashboardBridge(store, "fresh").snapshotJson()).isEqualTo("{}");
    Store empty = new Store(Files.createTempDirectory("b3").resolve("p.json"));
    assertThat(new DashboardBridge(empty, "g").snapshotJson()).isEqualTo("{}");
  }

  @Test
  void gameCannotOverwriteTheReservedHighScoreKey() {
    DashboardBridge b = new DashboardBridge(store, "rocket-run");
    b.setScore(50);
    b.save("highScore", "1");
    assertThat(b.load("highScore")).isEqualTo("50");
  }

  @Test
  void failedWriteDoesNotThrowIntoTheGame() throws IOException {
    Path dir = Files.createTempDirectory("b4");
    Store s = new Store(dir.resolve("p.json"));
    s.createProfile("A", "x");
    Files.delete(dir.resolve("p.json"));
    Files.delete(dir);
    DashboardBridge b = new DashboardBridge(s, "g");
    b.save("k", "1");
    b.setScore(3);
  }
}
