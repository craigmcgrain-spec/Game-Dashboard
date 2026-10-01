package com.example.dashboard.store;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;

public final class GamesFolder {

  private GamesFolder() {
  }

  /** First-run helper: copy the bundled games into the user's writable folder, never touching an existing manifest. */
  public static void seedIfMissing(Path seed, Path userDir) {
    if (!Files.isDirectory(seed) || Files.exists(userDir.resolve("manifest.json"))) {
      return;
    }
    try (Stream<Path> files = Files.walk(seed)) {
      for (Path from : (Iterable<Path>) files::iterator) {
        Path to = userDir.resolve(seed.relativize(from).toString());
        if (Files.isDirectory(from)) {
          Files.createDirectories(to);
        } else {
          Files.createDirectories(to.getParent());
          Files.copy(from, to, StandardCopyOption.REPLACE_EXISTING);
        }
      }
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
