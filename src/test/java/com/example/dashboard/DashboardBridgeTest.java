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
}
