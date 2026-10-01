package com.example.dashboard.store;

import com.example.dashboard.model.GameMetadata;
import com.google.gson.Gson;
import com.google.gson.JsonParseException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
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
    EntryDto[] raw;
    try {
      raw = GSON.fromJson(json, EntryDto[].class);
    } catch (JsonParseException e) {
      throw new IllegalArgumentException("manifest.json is not valid: " + e.getMessage(), e);
    }
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
      Optional<Path> entryPath = dto.entry == null ? Optional.empty() : inside(gamesDir, dto.entry);
      if (entryPath.isEmpty() || !Files.isRegularFile(entryPath.get())) {
        continue; // missing, unsafe or unusable entry: skip the game, keep the launcher alive
      }
      String title = dto.title == null || dto.title.isBlank() ? dto.id : dto.title;
      String icon = dto.icon == null || dto.icon.isBlank() ? "\uD83C\uDFAE" : dto.icon;
      games.add(new GameMetadata(dto.id, title, icon, dto.entry, dto.minAge, entryPath.get()));
    }
    return games;
  }

  /** Resolves {@code rel} under {@code dir}; empty if it escapes the folder or is not a valid path. */
  public static Optional<Path> inside(Path dir, String rel) {
    try {
      Path base = dir.toAbsolutePath().normalize();
      Path resolved = base.resolve(rel).normalize();
      return resolved.startsWith(base) ? Optional.of(resolved) : Optional.empty();
    } catch (InvalidPathException e) {
      return Optional.empty();
    }
  }

  private record EntryDto(String id, String title, String icon, String entry, Integer minAge) {
  }
}
