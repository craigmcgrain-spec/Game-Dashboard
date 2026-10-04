import com.example.dashboard.GamePage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javafx.animation.PauseTransition;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.concurrent.Worker;
import javafx.event.Event;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.HBox;
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
 * <p>Set {@code PROBE_OVERLAY=1} to reproduce the launcher's Game view: the WebView inside a
 * StackPane with the same Back/Scores HBox of Buttons on top, focus parked on a button. The
 * probe then evaluates the expression, fires a REAL JavaFX Space key event (a JS-dispatched
 * KeyboardEvent would not exercise JavaFX focus routing at all) and prints what happened.
 *
 * <p>Root cause of `Scene.snapshot` being useless here: an unshown stage renders WebView
 * content blank, so this probe shows the stage off-screen instead and reads the page.
 */
public class Probe extends Application {

    private Stage stage;
    private Scene scene;
    private WebEngine engine;
    private Node overlayFocusTarget;
    private int overlayFired = 0;
    private final boolean overlayMode = "1".equals(System.getenv("PROBE_OVERLAY"));
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

        StackPane root = new StackPane(view);
        if (overlayMode) {
            Button back = new Button("\u2190  Back");
            Button scores = new Button("\u2605 Scores");
            back.setOnAction(e -> overlayFired++);
            scores.setOnAction(e -> overlayFired++);
            HBox bar = new HBox(back, scores);
            bar.setAlignment(Pos.CENTER_LEFT);
            StackPane.setAlignment(bar, Pos.TOP_LEFT);
            root.getChildren().add(bar);
            overlayFocusTarget = back;
        }

        scene = new Scene(root, 1150, 780);
        stage.setScene(scene);
        stage.setX(-3000);
        stage.setY(-3000);
        stage.show();
        if (overlayFocusTarget != null) {
            // Must be after show(): requestFocus on a node whose scene is not yet showing is
            // ignored, which made an earlier run of this probe look like the WebView always
            // held focus and silently failed to reproduce the hazard at all.
            Platform.runLater(overlayFocusTarget::requestFocus);   // as if the child had just tapped Back
        }

        engine.getLoadWorker().stateProperty().addListener((o, old, state) -> {
            if (state == Worker.State.SUCCEEDED) {
                engine.executeScript(
                    "window.__probeErrors = [];"
                  + "window.addEventListener('error', function (e) {"
                  + "  window.__probeErrors.push(String(e.message) + ' @' + e.filename + ':' + e.lineno); });"
                  + "window.__sawSpace = false;"
                  + "window.addEventListener('keydown', function (e) { if (e.code === 'Space') window.__sawSpace = true; });");
                if (overlayMode) {
                    overlayStep();
                } else {
                    PauseTransition settle = new PauseTransition(Duration.millis(1200));
                    settle.setOnFinished(e -> next());
                    settle.play();
                }
            } else if (state == Worker.State.FAILED) {
                System.out.println("PROBE={\"loadFailed\":true}");
                Platform.exit();
            }
        });
        engine.load(tmp.toUri().toString());
    }

    /** Overlay mode: park focus on the overlay button, run the expression, then fire a real
     *  Space key and report who held focus and whether the buttons fired. */
    private void overlayStep() {
        if (overlayFocusTarget != null) {
            overlayFocusTarget.requestFocus();   // as if the child had just tapped Back
        }
        PauseTransition pre = new PauseTransition(Duration.millis(300));
        pre.setOnFinished(ignored -> {
            Object result;
            try {
                result = engine.executeScript(expression);
            } catch (RuntimeException ex) {
                result = "ERROR " + ex.getMessage();
            }
            final Object probeResult = result;
            Node beforeKey = scene.getFocusOwner();
            fireSpace();
            PauseTransition wait = new PauseTransition(Duration.millis(400));
            wait.setOnFinished(e -> {
                Object saw = engine.executeScript("String(!!window.__sawSpace)");
                Node owner = scene.getFocusOwner();
                System.out.println("PROBE=" + probeResult);
                System.out.println("OVERLAY={\"fired\":" + overlayFired
                    + ",\"sawSpace\":" + saw
                    + ",\"focusBeforeKey\":\"" + (beforeKey == null ? "null" : beforeKey.getClass().getSimpleName())
                    + "\",\"focusOwner\":\"" + (owner == null ? "null" : owner.getClass().getSimpleName()) + "\"}");
                Platform.exit();
            });
            wait.play();
        });
        pre.play();
    }

    private void fireSpace() {
        Node target = scene.getFocusOwner();
        if (target == null) {
            target = scene.getRoot();
        }
        Event.fireEvent(target, new KeyEvent(KeyEvent.KEY_PRESSED, " ", " ", KeyCode.SPACE, false, false, false, false));
        Event.fireEvent(target, new KeyEvent(KeyEvent.KEY_RELEASED, " ", " ", KeyCode.SPACE, false, false, false, false));
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
