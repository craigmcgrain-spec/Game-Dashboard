const { Engine, Render, Runner, Bodies, Composite, Constraint, Events, Body } = Matter;

// Config
const WIDTH = 1000;
const HEIGHT = 640;
const FLIPPER_WIDTH = 100;
const FLIPPER_HEIGHT = 20;
const BALL_RADIUS = 15;

let score = 0;
const scoreElement = document.getElementById('score-ui');
const highScoreElement = document.getElementById('high-score-ui');
const gameOverElement = document.getElementById('game-over');
let isGameOver = false;

// Audio Setup — JavaFX WebView ships no Web Audio API, so never assume it exists.
const AudioCtor = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtor ? new AudioCtor() : null;

const playPop = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

const playBoing = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
};

const updateScore = (points) => {
    score += points;
    scoreElement.innerText = `Score: ${score}`;
    if (window.dashboard) {
        window.dashboard.save("save", {
            score: score,
            ballPos: { x: ball.position.x, y: ball.position.y },
            ballVel: { x: ball.velocity.x, y: ball.velocity.y }
        });
    }
};

const triggerGameOver = () => {
    if (isGameOver) return;
    isGameOver = true;

    if (window.dashboard) {
        window.dashboard.setScore(score);
    }

    gameOverElement.style.display = 'block';
};

// 1. Setup Engine & Renderer
const engine = Engine.create();
const world = engine.world;

const render = Render.create({
    element: document.getElementById('game-container'),
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false,
        background: '#1a1a1a'
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 2. The Table (Walls)
const wallOptions = { isStatic: true, render: { fillStyle: '#444' } };
const walls = [
    // Top
    Bodies.rectangle(WIDTH / 2, 0, WIDTH, 40, wallOptions),
    // Left
    Bodies.rectangle(0, HEIGHT / 2, 40, HEIGHT, wallOptions),
    // Right
    Bodies.rectangle(WIDTH, HEIGHT / 2, 40, HEIGHT, wallOptions),
    // Bottom
    Bodies.rectangle(WIDTH / 2, HEIGHT, WIDTH, 40, wallOptions)
];
Composite.add(world, walls);

// 3. The Ball (Bouncing Bean)
const ball = Bodies.circle(WIDTH / 2, 100, BALL_RADIUS, {
    restitution: 0.8,
    friction: 0.005,
    frictionAir: 0.005,
    label: 'ball',
    render: { fillStyle: '#ff00ff' }
});
Composite.add(world, ball);

// Ball visual state for squash/stretch
let ballScale = { x: 1, y: 1 };

// 4. Flippers
const createFlipper = (x, y, side) => {
    const isLeft = side === 'left';
    const restingAngle = isLeft ? 0.3 : -0.3;

    const flipper = Bodies.rectangle(x, y, FLIPPER_WIDTH, FLIPPER_HEIGHT, {
        chamfer: { radius: FLIPPER_HEIGHT / 2 },
        render: { fillStyle: '#00ff00' },
        density: 0.01,
        label: 'flipper'
    });

    const pivot = Bodies.circle(isLeft ? x - FLIPPER_WIDTH / 2 : x + FLIPPER_WIDTH / 2, y, 5, {
        isStatic: true,
        render: { visible: false }
    });

    const constraint = Constraint.create({
        bodyA: pivot,
        bodyB: flipper,
        pointB: { x: isLeft ? -FLIPPER_WIDTH / 2 : FLIPPER_WIDTH / 2, y: 0 },
        stiffness: 1,
        length: 0
    });

    return { flipper, pivot, constraint, side, restingAngle };
};

const leftFlipperObj = createFlipper(WIDTH / 2 - 150, HEIGHT - 100, 'left');
const rightFlipperObj = createFlipper(WIDTH / 2 + 150, HEIGHT - 100, 'right');

Composite.add(world, [
    leftFlipperObj.flipper, leftFlipperObj.pivot, leftFlipperObj.constraint,
    rightFlipperObj.flipper, rightFlipperObj.pivot, rightFlipperObj.constraint
]);

// 5. Silly Bumpers
const createBumper = (x, y, radius, color, emoji, points) => {
    const bumper = Bodies.circle(x, y, radius, {
        isStatic: true,
        restitution: 1.5,
        render: { fillStyle: color },
        label: 'bumper',
        bumperData: { emoji, points }
    });
    return bumper;
};

const bumpers = [
    createBumper(WIDTH / 2, 200, 40, '#ffaa00', '😋', 100),
    createBumper(300, 300, 30, '#aa00ff', '🤪', 200),
    createBumper(700, 300, 30, '#00ffff', '😎', 200),
    createBumper(WIDTH / 2, 400, 50, '#ff0055', '😡', 500),
];
Composite.add(world, bumpers);
const initGame = () => {
    if (window.dashboard) {
        // 1. High Score
        const highScore = window.dashboard.load("highScore");
        if (highScore !== undefined) {
            highScoreElement.innerText = `Best: ${highScore}`;
        }

        // 2. Persistence (Resume)
        const saved = window.dashboard.load("save");
        if (saved && saved.ballPos && saved.ballVel) {
            score = saved.score || 0;
            scoreElement.innerText = `Score: ${score}`;
            Body.setPosition(ball, saved.ballPos);
            Body.setVelocity(ball, saved.ballVel);
        }
    }
};

initGame();

// 6. Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    keys[e.code] = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') playBoing();
    if (e.code === 'ArrowRight' || e.code === 'KeyD') playBoing();
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// 7. Events: Collision & Rendering
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        const ballBody = bodyA.label === 'ball' ? bodyA : (bodyB.label === 'ball' ? bodyB : null);
        const bumperBody = bodyA.label === 'bumper' ? bodyA : (bodyB.label === 'bumper' ? bodyB : null);

        if (ballBody && bumperBody) {
            const { emoji, points } = bumperBody.bumperData;
            updateScore(points);
            playPop();
            // Squash effect
            ballScale.x = 1.4;
            ballScale.y = 0.6;
        }
    });
});

// Visual skinning
Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    bumpers.forEach(bumper => {
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            bumper.bumperData.emoji,
            bumper.position.x,
            bumper.position.y
        );
    });
    
    // Draw ball with squash/stretch
    ctx.save();
    ctx.translate(ball.position.x, ball.position.y);
    ctx.scale(ballScale.x, ballScale.y);
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚪', 0, 0);
    ctx.restore();
});

// 8. Physics Loop Update
Events.on(engine, 'beforeUpdate', () => {
    if (isGameOver) return;

    const flipSpeed = 0.25;
    const maxAngle = 0.6;

    // Left Flipper
    if (keys['ArrowLeft'] || keys['KeyA']) {
        Body.setAngularVelocity(leftFlipperObj.flipper, -flipSpeed);
    }
    // Clamp Left
    if (leftFlipperObj.flipper.angle > maxAngle) {
        Body.setAngle(leftFlipperObj.flipper, maxAngle);
    } else if (leftFlipperObj.flipper.angle < leftFlipperObj.restingAngle) {
        Body.setAngularVelocity(leftFlipperObj.flipper, 0.05);
    }

    // Right Flipper
    if (keys['ArrowRight'] || keys['KeyD']) {
        Body.setAngularVelocity(rightFlipperObj.flipper, flipSpeed);
    }
    // Clamp Right
    if (rightFlipperObj.flipper.angle < -maxAngle) {
        Body.setAngle(rightFlipperObj.flipper, -maxAngle);
    } else if (rightFlipperObj.flipper.angle > rightFlipperObj.restingAngle) {
        Body.setAngularVelocity(rightFlipperObj.flipper, -0.05);
    }

    // Decay squash/stretch
    ballScale.x += (1 - ballScale.x) * 0.1;
    ballScale.y += (1 - ballScale.y) * 0.1;

    // Drain detection
    if (ball.position.y > HEIGHT + 50) {
        triggerGameOver();
    }
});
