package com.example.dashboard.store;

import com.example.dashboard.model.GameRecord;
import com.example.dashboard.model.Profile;
import com.google.gson.Gson;
import java.io.Closeable;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;

public class Store implements Closeable {

  private static final Random RANDOM = new Random();
  private static final String SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

  private final Path storeFile;
  private final Gson gson = new Gson();
  private final List<Profile> profiles = new ArrayList<>();
  private String activeId;

  public Store(Path storeFile) {
    this.storeFile = storeFile;
    load();
  }

  private void load() {
    try {
      if (Files.exists(storeFile) && Files.size(storeFile) > 0) {
        String text = Files.readString(storeFile, StandardCharsets.UTF_8);
        StoreData data = gson.fromJson(text, StoreData.class);
        if (data != null && data.profiles != null) {
          profiles.addAll(data.profiles);
          activeId = data.activeId;
        }
      }
    } catch (Exception e) {
      throw new RuntimeException("failed to read store at " + storeFile, e);
    }
  }

  public List<Profile> listProfiles() {
    return new ArrayList<>(profiles);
  }

  public Profile getProfile(String id) {
    for (Profile p : profiles) {
      if (p.getId().equals(id)) {
        return p;
      }
    }
    return null;
  }

  public Profile getActiveProfile() {
    if (profiles.isEmpty()) {
      return null;
    }
    if (activeId != null) {
      Profile byId = getProfile(activeId);
      if (byId != null) {
        return byId;
      }
    }
    return profiles.get(0);
  }

  public void setActiveProfile(String id) {
    if (getProfile(id) != null) {
      this.activeId = id;
      persist();
    }
  }

  public Profile createProfile(String name, String avatar) {
    String base = slugify(name);
    String id = base;
    while (getProfile(id) != null) {
      id = base + "-" + randomSuffix();
    }
    Profile profile = new Profile(id, name, avatar);
    profiles.add(profile);
    persist();
    return profile;
  }

  public void setScore(String gameId, int score) {
    Profile profile = requireActive();
    profile.gameRecord(gameId).recordScore(score);
    persist();
  }

  public Object load(String gameId, String key) {
    Profile profile = getActiveProfile();
    if (profile == null) {
      return null;
    }
    GameRecord record = profile.getGameIfPresent(gameId);
    return record == null ? null : record.load(key);
  }

  public void save(String gameId, String key, Object value) {
    Profile profile = requireActive();
    profile.gameRecord(gameId).putSave(key, gson.toJsonTree(value));
    persist();
  }

  public void persist() {
    StoreData data = new StoreData();
    data.activeId = activeId;
    data.profiles = profiles;
    String json = gson.toJson(data);
    try {
      Path parent = storeFile.toAbsolutePath().getParent();
      if (parent != null) {
        Files.createDirectories(parent);
      }
      Path tmp = Files.createTempFile(parent, "profiles", ".json.tmp");
      Files.writeString(tmp, json, StandardCharsets.UTF_8);
      Files.move(tmp, storeFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    } catch (IOException e) {
      throw new UncheckedIOException("failed to persist store to " + storeFile, e);
    }
  }

  @Override
  public void close() {
    // mutating methods persist immediately; nothing to flush
  }

  private Profile requireActive() {
    Profile profile = getActiveProfile();
    if (profile == null) {
      throw new IllegalStateException("no active profile");
    }
    return profile;
  }

  private static String slugify(String name) {
    String slug = name.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
    slug = slug.replaceAll("^-|-$", "");
    return slug.isEmpty() ? "user" : slug;
  }

  private static String randomSuffix() {
    StringBuilder sb = new StringBuilder(4);
    for (int i = 0; i < 4; i++) {
      sb.append(SUFFIX_CHARS.charAt(RANDOM.nextInt(SUFFIX_CHARS.length())));
    }
    return sb.toString();
  }

  private static class StoreData {
    String activeId;
    List<Profile> profiles = new ArrayList<>();
  }
}
