package com.example.dashboard.model;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

public final class GameMetadata {

  private final String id;
  private final String title;
  private final String icon;
  private final String entry;
  private final Integer minAge;
  private final Path entryPath;

  public GameMetadata(String id, String title, String icon, String entry, Integer minAge, Path entryPath) {
    this.id = id;
    this.title = title;
    this.icon = icon;
    this.entry = entry;
    this.minAge = minAge;
    this.entryPath = entryPath;
  }

  public String getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public String getIcon() {
    return icon;
  }

  public String getEntry() {
    return entry;
  }

  public Integer getMinAge() {
    return minAge;
  }

  public Optional<Path> entryFile() {
    return Files.exists(entryPath) ? Optional.of(entryPath) : Optional.empty();
  }
}
