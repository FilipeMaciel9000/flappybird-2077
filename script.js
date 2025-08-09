document.addEventListener('DOMContentLoaded', () => {
  // Game constants and configuration
  const CONFIG = {
    gravity: 0.5,
    jumpForce: -10,
    gameSpeed: 2,
    pipeGap: 150,
    pipeWidth: 60,
    pipeFrequency: 1500,
    difficultyIncreaseInterval: 5,
    initialBirdSizeRatio: 0.08,
    birdRotationAngle: 30,
    birdRotationDuration: 300,
    scoreAnimationDuration: 300,
    gridAnimationInterval: 100,
    neonColors: {
      green: 'var(--neon-light-green)',
      cyan: 'var(--neon-cyan)',
      pink: 'var(--neon-pink)',
    },
  };

  // DOM elements
  const elements = {
    gameContainer: document.getElementById('gameContainer'),
    bird: document.getElementById('bird'),
    scoreElement: document.getElementById('score'),
    gameOverScreen: document.getElementById('gameOver'),
    finalScoreElement: document.getElementById('finalScore'),
    restartButton: document.getElementById('restartButton'),
    startScreen: document.getElementById('startScreen'),
    startButton: document.getElementById('startButton'),
    gridOverlay: document.querySelector('.grid-overlay'),
  };

  // Game state
  const state = {
    gameRunning: false,
    score: 0,
    velocity: 0,
    birdPosition: 0,
    pipes: [],
    lastPipeTime: 0,
    animationId: null,
    highScore: parseInt(localStorage.getItem('flappyBird2077HighScore')) || 0,
    assetsLoaded: false,
    birdDimensions: { width: 0, height: 0, startX: 0, startY: 0 },
    currentConfig: { ...CONFIG },
  };

  // Sound effects
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const soundEffects = {
    jump: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.exponentialRampToValueAtTime(
        0.00001,
        audioContext.currentTime + 0.5
      );
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    },
    score: () => {
      // Add score sound effect if needed
    },
    gameOver: () => {
      // Add game over sound effect if needed
    },
  };

  // Asset preloading
  async function preloadAssets() {
    const assets = [
      { src: './assets/images/flappybird.png', type: 'image' },
      { src: './assets/images/neoncity.png', type: 'image' },
    ];

    const loadPromises = assets.map((asset) => {
      return new Promise((resolve) => {
        const resource = asset.type === 'image' ? new Image() : new Audio();
        resource.src = asset.src;
        resource.onload = resolve;
        resource.onerror = resolve; // Continue even if asset fails to load
      });
    });

    await Promise.all(loadPromises);
    state.assetsLoaded = true;
  }

  // Initialize game
  async function init() {
    await preloadAssets();
    updateDimensions();
    setupEventListeners();
    window.addEventListener('resize', debounce(updateDimensions, 100));

    if (state.assetsLoaded) {
      showStartScreen();
    }
  }

  // Update game dimensions based on container size
  function updateDimensions() {
    const birdSize = Math.min(
      elements.gameContainer.offsetWidth * CONFIG.initialBirdSizeRatio,
      elements.gameContainer.offsetHeight * CONFIG.initialBirdSizeRatio
    );

    elements.bird.style.width = `${birdSize}px`;
    elements.bird.style.height = `${birdSize}px`;

    state.birdDimensions = {
      width: birdSize,
      height: birdSize,
      startX: elements.gameContainer.offsetWidth * 0.25,
      startY: elements.gameContainer.offsetHeight * 0.5 - birdSize / 2,
    };

    if (!state.gameRunning) {
      elements.bird.style.top = `${state.birdDimensions.startY}px`;
    }
  }

  // Event listeners setup
  function setupEventListeners() {
    elements.startButton.addEventListener('click', startGame);
    elements.restartButton.addEventListener('click', startGame);

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (isJumpKey(e)) {
        if (!state.gameRunning) startGame();
        else jump();
      }
    });

    // Mouse/touch controls
    const handleInteraction = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      if (!state.gameRunning) startGame();
      else jump();
    };

    elements.gameContainer.addEventListener('click', handleInteraction);
    elements.gameContainer.addEventListener('touchstart', handleInteraction);
  }

  function isJumpKey(e) {
    return ['Space', ' ', 'ArrowUp'].includes(e.code || e.key);
  }

  // Bird jump action
  function jump() {
    state.velocity = state.currentConfig.jumpForce;
    elements.bird.style.transform = `rotate(-${CONFIG.birdRotationAngle}deg)`;
    soundEffects.jump();

    setTimeout(() => {
      elements.bird.style.transform = 'rotate(0deg)';
    }, CONFIG.birdRotationDuration);
  }

  // Start game function
  function startGame() {
    if (!state.assetsLoaded) return;

    cancelAnimationFrame(state.animationId);
    resetGame();
    updateDimensions();

    hideScreens();
    state.gameRunning = true;
    state.lastPipeTime = Date.now();
    gameLoop();
  }

  // Main game loop
  function gameLoop() {
    if (!state.gameRunning) return;

    updateBird();

    if (checkCollisions()) {
      gameOver();
      return;
    }

    if (Date.now() - state.lastPipeTime > state.currentConfig.pipeFrequency) {
      createPipe();
      state.lastPipeTime = Date.now();
    }

    updatePipes();
    state.animationId = requestAnimationFrame(gameLoop);
  }

  // Update bird position
  function updateBird() {
    state.velocity += state.currentConfig.gravity;
    state.birdPosition += state.velocity;
    elements.bird.style.top = `${state.birdPosition}px`;
  }

  // Check for collisions
  function checkCollisions() {
    // Boundary collision
    if (
      state.birdPosition < 0 ||
      state.birdPosition >
        elements.gameContainer.offsetHeight - state.birdDimensions.height
    ) {
      return true;
    }

    // Pipe collision
    return state.pipes.some((pipe, index) => {
      const birdRight =
        state.birdDimensions.startX + state.birdDimensions.width;
      const birdBottom = state.birdPosition + state.birdDimensions.height;
      const pipeRight = pipe.x + pipe.width;

      if (state.birdDimensions.startX < pipeRight && birdRight > pipe.x) {
        if (index % 2 === 0) {
          // Upper pipe
          return state.birdPosition < pipe.height;
        } else {
          // Lower pipe
          return birdBottom > elements.gameContainer.offsetHeight - pipe.height;
        }
      }
      return false;
    });
  }

  // Create new pipe pair
  function createPipe() {
    const gapPosition = getRandomGapPosition();
    const upperPipe = createPipeElement(gapPosition, 'upper');
    const lowerPipe = createPipeElement(gapPosition, 'lower');

    state.pipes.push({
      element: upperPipe,
      x: elements.gameContainer.offsetWidth,
      width: state.currentConfig.pipeWidth,
      height: gapPosition,
      passed: false,
    });

    state.pipes.push({
      element: lowerPipe,
      x: elements.gameContainer.offsetWidth,
      width: state.currentConfig.pipeWidth,
      height:
        elements.gameContainer.offsetHeight -
        gapPosition -
        state.currentConfig.pipeGap,
      passed: false,
    });
  }

  function getRandomGapPosition() {
    return (
      Math.random() *
        (elements.gameContainer.offsetHeight -
          state.currentConfig.pipeGap -
          100) +
      50
    );
  }

  function createPipeElement(gapPosition, type) {
    const pipe = document.createElement('div');
    pipe.className = `pipe pipe-${type}`;
    pipe.style.left = `${elements.gameContainer.offsetWidth}px`;
    pipe.style.width = `${state.currentConfig.pipeWidth}px`;

    if (type === 'upper') {
      pipe.style.top = '0';
      pipe.style.height = `${gapPosition}px`;
    } else {
      pipe.style.top = `${gapPosition + state.currentConfig.pipeGap}px`;
      pipe.style.height = `${
        elements.gameContainer.offsetHeight -
        gapPosition -
        state.currentConfig.pipeGap
      }px`;
    }

    addPipeDecoration(pipe, type === 'upper' ? 'bottom' : 'top');
    elements.gameContainer.appendChild(pipe);
    return pipe;
  }

  function addPipeDecoration(pipe, position) {
    const decor = document.createElement('div');
    decor.className = 'pipe-decor';
    decor.style[position] = '0';
    decor.style.background = `linear-gradient(to right, 
      ${CONFIG.neonColors.green}, 
      ${CONFIG.neonColors.cyan},
      ${CONFIG.neonColors.green})`;
    decor.style.boxShadow = `0 0 5px ${CONFIG.neonColors.green}`;
    pipe.appendChild(decor);
  }

  // Update pipes position and check for scoring
  function updatePipes() {
    for (let i = 0; i < state.pipes.length; i++) {
      const pipe = state.pipes[i];
      pipe.x -= state.currentConfig.gameSpeed;
      pipe.element.style.left = `${pipe.x}px`;

      // Remove off-screen pipes
      if (pipe.x + pipe.width < 0) {
        pipe.element.remove();
        state.pipes.splice(i, 1);
        i--;
        continue;
      }

      // Score update for upper pipes only
      if (
        i % 2 === 0 &&
        !pipe.passed &&
        pipe.x + pipe.width < state.birdDimensions.startX
      ) {
        pipe.passed = true;
        updateScore();
      }
    }
  }

  // Update score and difficulty
  function updateScore() {
    state.score++;
    elements.scoreElement.textContent = state.score;
    soundEffects.score();
    animateScore();

    if (state.score % state.currentConfig.difficultyIncreaseInterval === 0) {
      increaseDifficulty();
    }
  }

  function increaseDifficulty() {
    state.currentConfig.gameSpeed += 0.5;
    state.currentConfig.pipeFrequency = Math.max(
      800,
      state.currentConfig.pipeFrequency - 100
    );

    elements.gameContainer.style.boxShadow = `0 0 30px ${CONFIG.neonColors.cyan}`;
    setTimeout(() => {
      elements.gameContainer.style.boxShadow = `0 0 20px ${CONFIG.neonColors.cyan}`;
    }, 300);
  }

  function animateScore() {
    elements.scoreElement.style.transform = 'scale(1.5)';
    elements.scoreElement.style.color = CONFIG.neonColors.pink;

    setTimeout(() => {
      elements.scoreElement.style.transform = 'scale(1)';
      elements.scoreElement.style.color = CONFIG.neonColors.cyan;
    }, CONFIG.scoreAnimationDuration);
  }

  // Game over handling
  function gameOver() {
    state.gameRunning = false;
    cancelAnimationFrame(state.animationId);
    soundEffects.gameOver();

    // Update high score
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem('flappyBird2077HighScore', state.highScore);
    }

    // Update game over screen
    elements.finalScoreElement.innerHTML = `${state.score}<br><span class="text-sm">HIGH SCORE: ${state.highScore}</span>`;

    // Glitch effect
    elements.gameOverScreen.classList.add('glitch');
    setTimeout(() => {
      elements.gameOverScreen.classList.remove('glitch');
    }, 1000);

    showGameOverScreen();
  }

  // Reset game state
  function resetGame() {
    state.gameRunning = false;
    state.score = 0;
    state.velocity = 0;
    state.birdPosition = state.birdDimensions.startY;
    state.pipes = [];
    state.lastPipeTime = 0;
    state.animationId = null;
    state.currentConfig = { ...CONFIG };

    elements.scoreElement.textContent = '0';
    elements.bird.style.top = `${state.birdDimensions.startY}px`;
    elements.bird.style.transform = 'rotate(0deg)';

    // Clear existing pipes
    document.querySelectorAll('.pipe').forEach((pipe) => pipe.remove());
  }

  // Screen management
  function hideScreens() {
    elements.gameOverScreen.style.display = 'none';
    elements.startScreen.style.display = 'none';
  }

  function showStartScreen() {
    elements.startScreen.style.display = 'flex';
  }

  function showGameOverScreen() {
    elements.gameOverScreen.style.display = 'flex';
  }

  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function () {
      const context = this,
        args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // Grid animation
  setInterval(() => {
    elements.gridOverlay.style.backgroundPosition = `${Math.random() * 20}px ${
      Math.random() * 20
    }px`;
  }, CONFIG.gridAnimationInterval);

  // Initialize the game
  init();
});
