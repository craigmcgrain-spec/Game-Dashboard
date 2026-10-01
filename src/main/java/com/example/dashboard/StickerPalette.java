package com.example.dashboard;

/** The sticker-sheet colours. Each sticker pairs a saturated fill with an ink that stays readable on it. */
public final class StickerPalette {

  public static final String PAGE = "#2d5bff";
  public static final String LABEL_INK = "#16205c";

  private static final String[][] STICKERS = {
    {"#ff4d6d", "#ffffff"}, // cherry
    {"#8f5cf5", "#ffffff"}, // grape
    {"#0f8f42", "#ffffff"}, // grass
    {"#ffc83d", LABEL_INK}, // sun
    {"#ff8a3d", LABEL_INK}, // tangerine
    {"#17c3d6", LABEL_INK}, // aqua
  };

  private StickerPalette() {
  }

  public static int size() {
    return STICKERS.length;
  }

  public static String fill(int i) {
    return STICKERS[Math.floorMod(i, STICKERS.length)][0];
  }

  public static String ink(int i) {
    return STICKERS[Math.floorMod(i, STICKERS.length)][1];
  }

  /** Stable sticker for a player id, so a child's colour never changes. */
  public static int indexFor(String key) {
    return Math.floorMod(key.hashCode(), STICKERS.length);
  }

  /** WCAG contrast ratio of two #rrggbb colours. */
  public static double contrast(String a, String b) {
    double la = luminance(a);
    double lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  private static double luminance(String hex) {
    double[] c = new double[3];
    for (int i = 0; i < 3; i++) {
      double v = Integer.parseInt(hex.substring(1 + i * 2, 3 + i * 2), 16) / 255.0;
      c[i] = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
}
