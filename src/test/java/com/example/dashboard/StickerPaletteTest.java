package com.example.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StickerPaletteTest {

  @Test
  void everyStickerInkIsReadableOnItsFill() {
    for (int i = 0; i < StickerPalette.size(); i++) {
      assertThat(StickerPalette.contrast(StickerPalette.fill(i), StickerPalette.ink(i)))
          .as("sticker %d", i).isGreaterThanOrEqualTo(3.0);
    }
  }

  @Test
  void labelInkIsReadableOnTheWhiteLabelPlate() {
    assertThat(StickerPalette.contrast("#ffffff", StickerPalette.LABEL_INK)).isGreaterThanOrEqualTo(7.0);
  }

  @Test
  void aPlayerAlwaysGetsTheSameSticker() {
    assertThat(StickerPalette.indexFor("mia")).isEqualTo(StickerPalette.indexFor("mia"));
    assertThat(StickerPalette.indexFor("mia")).isBetween(0, StickerPalette.size() - 1);
  }

  @Test
  void indexForNeverGoesNegative() {
    // String.hashCode can be Integer.MIN_VALUE or negative; the index must still be valid
    for (String k : new String[] {"", "polygenelubricants", "a", "zzzzzzzzzzzz"}) {
      assertThat(StickerPalette.indexFor(k)).isBetween(0, StickerPalette.size() - 1);
    }
  }

  @Test
  void gameStickersCycleThroughThePalette() {
    assertThat(StickerPalette.fill(StickerPalette.size())).isEqualTo(StickerPalette.fill(0));
  }
}
