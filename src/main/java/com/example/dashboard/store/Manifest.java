package com.example.dashboard.store;

import com.example.dashboard.model.GameMetadata;
import com.google.gson.Gson;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class Manifest {

  private static final Gson GSON = new Gson();
  private static final String ID_PATTERN = "[a-z0-9-]+";

  private Manifest() {
  }

  public static List<GameMetadata> load(Path gamesDir) throws IOException {
    Path manifestPath = gamesDir.resolve("manifest.json");
    if (!Files.exists(manifestPath)) {
      return List.of();
    }
    String json = Files.readString(manifestPath, StandardCharsets.UTF_8);
    EntryDto[] raw = GSON.fromJson(json, EntryDto[].class);
    if (raw == null) {
      throw new IllegalArgumentException("manifest is empty or malformed: " + manifestPath);
    }
    List<GameMetadata> games = new ArrayList<>();
    Set<String> ids = new HashSet<>();
    for (EntryDto dto : raw) {
      if (dto == null || dto.id == null || !dto.id.matches(ID_PATTERN)) {
        throw new IllegalArgumentException("invalid game id in manifest: " + (dto == null ? "null" : dto.id));
      }
      if (!ids.add(dto.id)) {
        throw new IllegalArgumentException("duplicate game id in manifest: " + dto.id);
      }
      Path entryPath = gamesDir.resolve(dto.entry);
      if (!Files.exists(entryPath)) {
        continue;
      }
      games.add(new GameMetadata(dto.id, dto.title, dto.icon, dto.entry, dto.minAge, entryPath));
    }
    return games;
  }

  private record EntryDto(String id, String title, String icon, String entry, Integer minAge) {
  }
}
