// Uses the launcher's window.dashboard API when present; also runs standalone in a browser.
var dash = window.dashboard;
var score = 0, left = 0, timer = null;
var best = dash ? dash.load("highScore") : undefined;
var bestEl = document.getElementById("best");
if (best !== undefined) bestEl.textContent = "Best: " + best;

document.getElementById("rocket").onclick = function () {
  if (left > 0) { score++; document.getElementById("score").textContent = "Score: " + score; }
};
document.getElementById("start").onclick = function () {
  score = 0; left = 10;
  document.getElementById("score").textContent = "Score: 0";
  clearInterval(timer);
  timer = setInterval(function () {
    left--;
    document.getElementById("time").textContent = left > 0 ? left + "s left" : "Time's up!";
    if (left <= 0) {
      clearInterval(timer);
      if (dash) { dash.setScore(score); dash.save("lastScore", score); }
      var b = dash ? dash.load("highScore") : score;
      if (b !== undefined) bestEl.textContent = "Best: " + b;
    }
  }, 1000);
};
