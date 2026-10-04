(function () {
  var canvas = document.getElementById('game');
  if (!canvas) throw new Error('canvas #game not found');
  Game.init(canvas);
})();
