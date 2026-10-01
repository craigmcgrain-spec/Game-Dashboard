package com.example.dashboard;

import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JavaFX WebView has no "before page scripts" hook, so the launcher rewrites the game's HTML to start with a shim.
 * The shim already holds the player's saved data (so load() is synchronous) and queues writes until the Java
 * bridge ({@code window.runtime}) is attached after the page loads.
 */
public final class GamePage {

  private static final String SHIM = """
      <script>
      (function () {
        var data = Object.assign(Object.create(null), SNAPSHOT);
        var queue = [];
        function send(m, a) { if (window.runtime) { window.runtime[m].apply(window.runtime, a); } else { queue.push([m, a]); } }
        window.__dashboardReady = function () {
          var q = queue; queue = [];
          q.forEach(function (c) { window.runtime[c[0]].apply(window.runtime, c[1]); });
        };
        window.dashboard = {
          save: function (k, v) {
            k = String(k);
            if (k === "highScore") { return; }
            var s = JSON.stringify(v);
            if (s === undefined) { s = "null"; }
            data[k] = JSON.parse(s);
            send("save", [k, s]);
          },
          load: function (k) {
            var v = data[String(k)];
            return v === null ? undefined : v;
          },
          setScore: function (n) {
            n = Math.round(Number(n));
            if (!isFinite(n)) { return; }
            if (!(data.highScore >= n)) { data.highScore = n; }
            send("setScore", [n]);
          }
        };
      })();
      </script>
      """;

  private static final Pattern HEAD = Pattern.compile("<head[^>]*>", Pattern.CASE_INSENSITIVE);
  private static final Pattern HTML = Pattern.compile("<html[^>]*>", Pattern.CASE_INSENSITIVE);

  private GamePage() {
  }

  public static String prepare(String html, Path gameDir, String snapshotJson) {
    String base = gameDir.toUri().toString();
    if (!base.endsWith("/")) {
      base += "/";
    }
    String inject = "<base href=\"" + base + "\">\n"
        + SHIM.replace("SNAPSHOT", snapshotJson.replace("</", "<\\/"));
    Matcher m = HEAD.matcher(html);
    if (m.find()) {
      return html.substring(0, m.end()) + inject + html.substring(m.end());
    }
    m = HTML.matcher(html);
    if (m.find()) {
      return html.substring(0, m.end()) + "<head>" + inject + "</head>" + html.substring(m.end());
    }
    return inject + html;
  }
}
