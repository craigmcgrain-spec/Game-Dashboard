import com.example.dashboard.GamePage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javafx.animation.PauseTransition;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.concurrent.Worker;
import javafx.scene.Scene;
import javafx.scene.layout.StackPane;
import javafx.scene.web.WebEngine;
import javafx.scene.web.WebView;
import javafx.stage.Stage;
import javafx.util.Duration;

/**
 * Dev tool: load a Game Dashboard game through the launcher's real page-preparation path
 * ({@link GamePage#prepare}) inside JavaFX WebView, then evaluate a JavaScript expression
 * against it and print the result. This is the only way to verify a game's runtime
 * behaviour, because the launcher's WebView differs from a browser in ways that silently
 * break games (no Web Audio, canvas ellipse is a no-op, canvas shadows cost ~10x fps).
 *
 * <p>usage: {@code Probe <gameDir> <jsExpression> [WxH,WxH,...]}
 *
 * <p>Root cause of `Scene.snapshot` being useless here: an unshown stage renders WebView
 * content blank, so this probe shows the stage off-screen instead and reads the page.
 */
public class Probe extends Application {

    private Stage stage;
    private WebEngine engine;
    private String expression;
    private String[] sizes;
    private int index;

    @Override
    public void start(Stage stage) throws Exception {
        this.stage = stage;
        List<String> raw = getParameters().getRaw();
        Path gameDir = Path.of(raw.get(0));
        expression = raw.get(1);
        sizes = (raw.size() > 2 ? raw.get(2) : "1150x780").split(",");

        String prepared = GamePage.prepare(Files.readString(gameDir.resolve("index.html")), gameDir, "{}");
        Path tmp = Files.createTempFile("probe-", ".html");
        Files.writeString(tmp, prepared);

        WebView view = new WebView();
        engine = view.getEngine();
        stage.setScene(new Scene(new StackPane(view), 1150, 780));
        stage.setX(-3000);
        stage.setY(-3000);
        stage.show();

        engine.getLoadWorker().stateProperty().addListener((o, old, state) -> {
            if (state == Worker.State.SUCCEEDED) {
                engine.executeScript(
                    "window.__probeErrors = [];"
                  + "window.addEventListener('error', function (e) {"
                  + "  window.__probeErrors.push(String(e.message) + ' @' + e.filename + ':' + e.lineno); });");
                PauseTransition settle = new PauseTransition(Duration.millis(1200));
                settle.setOnFinished(e -> next());
                settle.play();
            } else if (state == Worker.State.FAILED) {
                System.out.println("PROBE={\"loadFailed\":true}");
                Platform.exit();
            }
        });
        engine.load(tmp.toUri().toString());
    }

    private void next() {
        if (index >= sizes.length) {
            Platform.exit();
            return;
        }
        String size = sizes[index++];
        parse(size);
        PauseTransition wait = new PauseTransition(Duration.millis(500));
        wait.setOnFinished(e -> report(size));
        wait.play();
    }

    private void parse(String size) {
        int x = size.indexOf('x');
        stage.setWidth(Double.parseDouble(size.substring(0, x)));
        stage.setHeight(Double.parseDouble(size.substring(x + 1)));
    }

    private void report(String size) {
        Object result;
        try {
            result = engine.executeScript(expression);
        } catch (RuntimeException ex) {
            result = "ERROR " + ex.getMessage();
        }
        System.out.println((sizes.length == 1 ? "PROBE=" : "PROBE@" + size + "=") + result);
        if (index >= sizes.length) {
            Platform.exit();
        } else {
            next();
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}
