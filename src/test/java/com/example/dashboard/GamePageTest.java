package com.example.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class GamePageTest {

  static final Path DIR = Path.of("/tmp/my games/rocket-run");

  @Test
  void shimAndBaseGoFirstInsideHead() {
    String out = GamePage.prepare("<!DOCTYPE html><html><head><title>x</title></head><body>hi</body></html>", DIR, "{}");
    int head = out.indexOf("<head>");
    int base = out.indexOf("<base href=\"file:///tmp/my%20games/rocket-run/\">");
    int shim = out.indexOf("window.dashboard");
    int title = out.indexOf("<title>");
    assertThat(head).isGreaterThanOrEqualTo(0);
    assertThat(base).isGreaterThan(head).isLessThan(title);
    assertThat(shim).isGreaterThan(base).isLessThan(title);
  }

  @Test
  void worksWhenThereIsNoHeadTag() {
    String out = GamePage.prepare("<html><body>hi</body></html>", DIR, "{}");
    assertThat(out).contains("window.dashboard").contains("<body>hi</body>");
    assertThat(out.indexOf("window.dashboard")).isLessThan(out.indexOf("<body>"));
  }

  @Test
  void worksOnBareFragment() {
    assertThat(GamePage.prepare("<p>hi</p>", DIR, "{}")).contains("window.dashboard").contains("<p>hi</p>");
  }

  @Test
  void snapshotCannotBreakOutOfTheScriptTag() {
    String out = GamePage.prepare("<html><head></head></html>", DIR, "{\"a\":\"</script><b>x</b>\"}");
    assertThat(out).doesNotContain("</script><b>");
    assertThat(out).contains("<\\/script>");
  }

  @Test
  void snapshotIsEmbeddedAsTheInitialData() {
    assertThat(GamePage.prepare("<html><head></head></html>", DIR, "{\"highScore\":42}")).contains("{\"highScore\":42}");
  }
}
