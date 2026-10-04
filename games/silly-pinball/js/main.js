(function () {
  var canvas = document.getElementById('game');
  if (!canvas) throw new Error('canvas #game not found');
  Input.init(canvas);
  Game.init(canvas);
  Input.claimFocus();
})();
