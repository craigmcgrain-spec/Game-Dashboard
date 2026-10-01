package com.example.dashboard.store;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

final class Json {

  private Json() {
  }

  static JsonElement parse(String text) {
    return JsonParser.parseString(text);
  }
}
