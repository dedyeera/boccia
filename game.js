const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const statusMessageElement = document.getElementById('status-message');

// --- 定数 ---
const METER = 100; // 1m = 100px
const CANVAS_WIDTH = 6 * METER;
const CANVAS_HEIGHT = 12.5 * METER;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const BALL_RADIUS = 15;
const JACK_BALL_RADIUS = 15;
const FRICTION = 0.98;

const THROWING_BOX_DEPTH = 2.5 * METER;
const THROWING_BOX_WIDTH = 1 * METER;
const THROWING_LINE_Y = CANVAS_HEIGHT - THROWING_BOX_DEPTH;
const V_LINE_Y = THROWING_LINE_Y - 3 * METER;
const DEAD_BALL_LINE_Y = CANVAS_HEIGHT;
const CROSS_CENTER_X = CANVAS_WIDTH / 2;
const CROSS_CENTER_Y = 4 * METER;
const CROSS_LINE_LENGTH = 0.5 * METER;

const TOTAL_ENDS = 4;

// --- ゲーム状態 ---
let gameState = 'WAITING_FOR_JACK_BALL';
let balls = [];
let currentPlayer = 'red';
let redBallsLeft = 6;
let blueBallsLeft = 6;
let redScore = 0;
let blueScore = 0;
let isThrowing = false;
let throwStartX, throwStartY;
let endStarter = 'red';
let selectedBox = 1;
let currentEnd = 1;

// --- ボールクラス ---
class Ball {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.isDead = false;
        this.rotation = 0;
    }

    draw() {
        if (this.isDead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius, 0);
        ctx.stroke();
        ctx.restore();
    }

    update() {
        if (this.isDead) return;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.rotation += (this.vy > 0 ? 1 : -1) * speed * 0.05;
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
            this.vx = 0;
            this.vy = 0;
        }
    }
}

// --- 初期化 ---
function init() {
    document.querySelectorAll('input[name="throwing-box"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedBox = parseInt(e.target.value);
        });
    });
    resetEnd();
    gameLoop();
}

// --- エンドリセット ---
function resetEnd() {
    balls = [];
    redBallsLeft = 6;
    blueBallsLeft = 6;
    currentPlayer = endStarter;
    gameState = 'WAITING_FOR_JACK_BALL';
    updateGameInfo();
    updateStatusMessage();
}

// --- ゲームループ ---
function gameLoop() {
    // 1. 更新処理
    update();
    // 2. 描画処理
    draw();

    if (gameState !== 'GAME_OVER') {
        requestAnimationFrame(gameLoop);
    }
}

// --- 更新処理のメイン関数 ---
function update() {
    if (gameState === 'GAME_OVER') return;

    balls.forEach(ball => {
        ball.update();
        handleWallCollision(ball);
    });

    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            handleCollision(balls[i], balls[j]);
        }
    }
    
    if (areAllBallsStopped()) {
        if (gameState === 'JACK_BALL_MOVING') {
            handleJackBallStopped();
        } else if (gameState === 'COLOR_BALL_MOVING') {
            handleColorBallStopped();
        }
    }
}

// --- 描画処理のメイン関数 ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    drawCourt();
    ctx.restore();

    balls.forEach(ball => {
        ball.draw();
    });

    // 投球待機中のボールをプレビュー表示
    const boxCenterX = (selectedBox - 1) * THROWING_BOX_WIDTH + (THROWING_BOX_WIDTH / 2);
    const boxY = THROWING_LINE_Y + 40;

    if (gameState === 'WAITING_FOR_JACK_BALL') {
        const previewJack = new Ball(boxCenterX, boxY, JACK_BALL_RADIUS, 'white');
        previewJack.draw();
    } else if (gameState === 'WAITING_FOR_THROW') {
        const previewColorBall = new Ball(boxCenterX, boxY, BALL_RADIUS, currentPlayer);
        previewColorBall.draw();
    }

    if (gameState === 'GAME_OVER') {
        drawGameOver();
    }
}


// --- 描画関連 ---
function drawCourt() {
    ctx.fillStyle = '#006400';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.beginPath();
    ctx.moveTo(0, THROWING_LINE_Y);
    ctx.lineTo(CANVAS_WIDTH, THROWING_LINE_Y);
    for (let i = 1; i < 6; i++) {
        ctx.moveTo(i * THROWING_BOX_WIDTH, THROWING_LINE_Y);
        ctx.lineTo(i * THROWING_BOX_WIDTH, CANVAS_HEIGHT);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, V_LINE_Y);
    ctx.lineTo(CANVAS_WIDTH, V_LINE_Y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CROSS_CENTER_X - CROSS_LINE_LENGTH / 2, CROSS_CENTER_Y);
    ctx.lineTo(CROSS_CENTER_X + CROSS_LINE_LENGTH / 2, CROSS_CENTER_Y);
    ctx.moveTo(CROSS_CENTER_X, CROSS_CENTER_Y - CROSS_LINE_LENGTH / 2);
    ctx.lineTo(CROSS_CENTER_X, CROSS_CENTER_Y + CROSS_LINE_LENGTH / 2);
    ctx.stroke();
    ctx.font = "16px Arial";
    ctx.fillStyle = "white";
    // ctx.fillText("V-Line", 5, V_LINE_Y - 10);
    // ctx.fillText("Throwing Box", 5, THROWING_LINE_Y + 20);
    for (let i = 0; i < 6; i++) {
        ctx.fillText(i + 1, i * THROWING_BOX_WIDTH + 5, THROWING_LINE_Y - 5);
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = 'white';
    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
    const winner = redScore > blueScore ? '赤の勝利！' : blueScore > redScore ? '青の勝利！' : '引き分け';
    ctx.font = '40px Arial';
    ctx.fillText(winner, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = '30px Arial';
    ctx.fillText(`最終スコア: 赤 ${redScore} - 青 ${blueScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
}

// --- UI更新 ---
function updateGameInfo() {
    document.getElementById('current-player').textContent = currentPlayer === 'red' ? '赤' : '青';
    document.getElementById('red-balls').textContent = redBallsLeft;
    document.getElementById('blue-balls').textContent = blueBallsLeft;
    document.getElementById('red-score').textContent = redScore;
    document.getElementById('blue-score').textContent = blueScore;
    document.getElementById('current-end').textContent = currentEnd;
    document.getElementById('total-ends').textContent = TOTAL_ENDS;
}

function updateStatusMessage() {
    let message = '';
    const playerColor = currentPlayer === 'red' ? '赤' : '青';
    switch (gameState) {
        case 'WAITING_FOR_JACK_BALL':
            message = `${playerColor}チーム、ジャックボールを投球してください。`;
            break;
        case 'WAITING_FOR_THROW':
            message = `${playerColor}チーム、投球してください。`;
            break;
        case 'JACK_BALL_MOVING':
        case 'COLOR_BALL_MOVING':
            message = 'ボールが動いています...';
            break;
        case 'END_OF_END':
            message = 'エンド終了！スコアを計算しています...';
            break;
        case 'GAME_OVER':
            message = 'ゲーム終了！';
            break;
    }
    statusMessageElement.textContent = message;
}

// --- イベントリスナー ---
function handleThrowStart(x, y) {
    if (gameState !== 'WAITING_FOR_THROW' && gameState !== 'WAITING_FOR_JACK_BALL') return;
    if (isThrowing) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;

    const boxXStart = (selectedBox - 1) * THROWING_BOX_WIDTH;
    const boxXEnd = selectedBox * THROWING_BOX_WIDTH;

    if (canvasX < boxXStart || canvasX > boxXEnd || canvasY < THROWING_LINE_Y) {
        // alert(`ボックス${selectedBox}の中から投球してください。`);
        return;
    }

    throwStartX = canvasX;
    throwStartY = canvasY;
    isThrowing = true;
}

function handleThrowEnd(x, y) {
    if (!isThrowing) return;
    isThrowing = false;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const throwEndX = (x - rect.left) * scaleX;
    const throwEndY = (y - rect.top) * scaleY;

    const dx = throwEndX - throwStartX;
    const dy = throwEndY - throwStartY;
    const angle = Math.atan2(dy, dx);
    const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 10, 30);

    if (power < 1) {
        return; // 小さすぎる動きは無視
    }
    if (gameState === 'WAITING_FOR_JACK_BALL') {
        newBall = new Ball(throwStartX, throwStartY, JACK_BALL_RADIUS, 'white');
        gameState = 'JACK_BALL_MOVING';
    } else if (gameState === 'WAITING_FOR_THROW') {
        if (currentPlayer === 'red' && redBallsLeft > 0) {
            redBallsLeft--;
        } else if (currentPlayer === 'blue' && blueBallsLeft > 0) {
            blueBallsLeft--;
        } else {
            return;
        }
        newBall = new Ball(throwStartX, throwStartY, BALL_RADIUS, currentPlayer);
        gameState = 'COLOR_BALL_MOVING';
    }

    if (newBall) {
        newBall.vx = Math.cos(angle) * power;
        newBall.vy = Math.sin(angle) * power;
        balls.push(newBall);
    }
    
    updateGameInfo();
    updateStatusMessage();
}


// --- マウスイベント ---
canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    handleThrowStart(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', e => {
    e.preventDefault();
    handleThrowEnd(e.clientX, e.clientY);
});

// --- タッチイベント ---
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length > 0) {
        handleThrowStart(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.changedTouches.length > 0) {
        handleThrowEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
}, { passive: false });

// --- ゲームロジック ---
function getJackBall() {
    return balls.find(b => b.color === 'white');
}

function handleJackBallStopped() {
    const jackBall = getJackBall();
    const isJackValid = jackBall && !jackBall.isDead && jackBall.y < V_LINE_Y;

    if (!isJackValid) {
        alert("ジャックボールが無効です。相手プレイヤーが投げ直します。");
        balls = []; // 全てのボールをリセット
        currentPlayer = (endStarter === 'red') ? 'blue' : 'red';
        gameState = 'WAITING_FOR_JACK_BALL';
    } else {
        gameState = 'WAITING_FOR_THROW';
    }
    updateStatusMessage();
}

function handleColorBallStopped() {
    // ボールがコースアウトしたか判定
    balls.forEach(ball => {
        if (!ball.isDead) {
            if (ball.x - ball.radius < 0 || ball.x + ball.radius > CANVAS_WIDTH || 
                ball.y - ball.radius < 0 || ball.y + ball.radius > DEAD_BALL_LINE_Y) {
                ball.isDead = true;
            }
        }
    });

    // ジャックボールがコースアウトした場合の処理
    const jackBall = getJackBall();
    if (jackBall && jackBall.isDead) {
        alert("ジャックボールがコースアウトしたため、クロスに再配置されます。");
        jackBall.x = CROSS_CENTER_X;
        jackBall.y = CROSS_CENTER_Y;
        jackBall.isDead = false;
        jackBall.vx = 0;
        jackBall.vy = 0;
    }

    // 全てのボールが投げ終わったか
    if (redBallsLeft === 0 && blueBallsLeft === 0) {
        gameState = 'END_OF_END';
        updateStatusMessage();
        calculateScore();
        setTimeout(() => {
            alert(`エンド終了！ スコア: 赤 ${redScore} - 青 ${blueScore}`);
            if (currentEnd >= TOTAL_ENDS) {
                gameState = 'GAME_OVER';
                updateStatusMessage();
            } else {
                currentEnd++;
                resetEnd();
            }
        }, 2000);
    } else {
        determineNextPlayer();
        gameState = 'WAITING_FOR_THROW';
        updateStatusMessage();
    }
    updateGameInfo();
}

function determineNextPlayer() {
    const jackBall = getJackBall();
    if (!jackBall || jackBall.isDead) return;

    const redBalls = balls.filter(b => b.color === 'red' && !b.isDead);
    const blueBalls = balls.filter(b => b.color === 'blue' && !b.isDead);

    if (redBalls.length === 0 && blueBalls.length === 0) return;

    const closestRed = getClosestBall(redBalls);
    const closestBlue = getClosestBall(blueBalls);

    if (!closestRed) {
        if (redBallsLeft > 0) currentPlayer = 'red';
        return;
    }
    if (!closestBlue) {
        if (blueBallsLeft > 0) currentPlayer = 'blue';
        return;
    }

    if (closestRed.dist <= closestBlue.dist) {
        currentPlayer = 'blue';
    } else {
        currentPlayer = 'red';
    }
    
    if (currentPlayer === 'red' && redBallsLeft === 0) {
        currentPlayer = 'blue';
    } else if (currentPlayer === 'blue' && blueBallsLeft === 0) {
        currentPlayer = 'red';
    }
}

function calculateScore() {
    const jackBall = getJackBall();
    if (!jackBall || jackBall.isDead) return;

    const redBalls = balls.filter(b => b.color === 'red' && !b.isDead);
    const blueBalls = balls.filter(b => b.color === 'blue' && !b.isDead);
    
    const closestRed = getClosestBall(redBalls);
    const closestBlue = getClosestBall(blueBalls);

    if (!closestRed && !closestBlue) {
        endStarter = endStarter === 'red' ? 'blue' : 'red';
        return;
    }

    let winningColor, endScore = 0;
    if (!closestRed) {
        winningColor = 'blue';
    } else if (!closestBlue) {
        winningColor = 'red';
    } else {
        winningColor = closestRed.dist < closestBlue.dist ? 'red' : 'blue';
    }
    
    const losingColor = winningColor === 'red' ? 'blue' : 'red';
    const losingBalls = balls.filter(b => b.color === losingColor && !b.isDead);
    const closestLosingBall = getClosestBall(losingBalls);
    const closestLosingDist = closestLosingBall ? closestLosingBall.dist : Infinity;

    balls.filter(b => b.color === winningColor && !b.isDead).forEach(ball => {
        if (getDistance(ball, jackBall) < closestLosingDist) {
            endScore++;
        }
    });

    if (endScore > 0) {
        if (winningColor === 'red') {
            redScore += endScore;
        } else {
            blueScore += endScore;
        }
        endStarter = winningColor;
    } else {
        endStarter = endStarter === 'red' ? 'blue' : 'red';
    }
}

// --- ヘルパー関数 ---
function areAllBallsStopped() {
    return balls.every(ball => ball.vx === 0 && ball.vy === 0);
}

function getDistance(ball1, ball2) {
    if (!ball1 || !ball2 || ball1.isDead || ball2.isDead) return Infinity;
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function getClosestBall(ballArray) {
    const jackBall = getJackBall();
    if (!jackBall || !ballArray || ballArray.length === 0) return null;
    return ballArray
        .filter(b => !b.isDead)
        .reduce((closest, ball) => {
            const dist = getDistance(ball, jackBall);
            if (dist < closest.dist) {
                return { ball, dist };
            }
            return closest;
        }, { ball: null, dist: Infinity });
}

// --- 衝突処理 ---
function handleCollision(ball1, ball2) {
    if (ball1.isDead || ball2.isDead) return;
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < ball1.radius + ball2.radius) {
        const angle = Math.atan2(dy, dx);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const vx1 = ball1.vx * cos + ball1.vy * sin;
        const vy1 = ball1.vy * cos - ball1.vx * sin;
        const vx2 = ball2.vx * cos + ball2.vy * sin;
        const vy2 = ball2.vy * cos - ball2.vx * sin;
        const totalMass = ball1.radius + ball2.radius;
        const vx1Final = ((ball1.radius - ball2.radius) * vx1 + 2 * ball2.radius * vx2) / totalMass;
        const vx2Final = ((ball2.radius - ball1.radius) * vx2 + 2 * ball1.radius * vx1) / totalMass;
        ball1.vx = vx1Final * cos - vy1 * sin;
        ball1.vy = vy1 * cos + vx1Final * sin;
        ball2.vx = vx2Final * cos - vy2 * sin;
        ball2.vy = vy2 * cos + vx2Final * sin;
        const overlap = ball1.radius + ball2.radius - distance;
        ball1.x -= overlap * cos / 2;
        ball1.y -= overlap * sin / 2;
        ball2.x += overlap * cos / 2;
        ball2.y += overlap * sin / 2;
    }
}

function handleWallCollision(ball) {
    if (ball.isDead) return;
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > CANVAS_WIDTH ||
        ball.y - ball.radius < 0 || ball.y + ball.radius > CANVAS_HEIGHT) {
        ball.isDead = true;
        ball.vx = 0; // 停止させる
        ball.vy = 0; // 停止させる
    }
}

// --- ゲーム開始 ---
init();