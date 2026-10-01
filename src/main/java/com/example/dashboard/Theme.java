package com.example.dashboard;

import javafx.scene.text.Font;

public final class Theme {

  private static boolean loaded;

  private Theme() {
  }

  /** Registers the bundled display face ("Lilita One", SIL OFL) so CSS can use it by name. */
  public static synchronized void loadFonts() {
    if (!loaded) {
      try (var in = Theme.class.getResourceAsStream("/fonts/LilitaOne-Regular.ttf")) {
        Font.loadFont(in, 12);
      } catch (java.io.IOException e) {
        // falls back to the platform sans; the layout still works
      }
      loaded = true;
    }
  }
}
