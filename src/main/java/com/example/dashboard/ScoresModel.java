package com.example.dashboard;

import com.example.dashboard.model.GameMetadata;
import com.example.dashboard.model.GameRecord;
import com.example.dashboard.model.Profile;
import java.util.ArrayList;
import java.util.List;

public final class ScoresModel {

  public record Row(GameMetadata game, String title, Long highScore, String playedAt, boolean hasSave) {
  }

  private ScoresModel() {
  }

  public static List<Row> rows(Profile profile, List<GameMetadata> games) {
    List<Row> rows = new ArrayList<>();
    if (profile == null) {
      return rows;
    }
    for (GameMetadata g : games) {
      GameRecord r = profile.getGameIfPresent(g.getId());
      Long score = r != null && r.load("highScore") instanceof Long l ? l : null;
      rows.add(new Row(g, g.getTitle(), score, r == null ? null : r.getPlayedAt(), r != null && r.hasSave()));
    }
    return rows;
  }
}
