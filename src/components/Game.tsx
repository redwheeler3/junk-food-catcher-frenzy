import { useState, useEffect, useCallback, useRef } from "react";
import { playEatSound, playFartSound, startBgm, stopBgm } from "@/lib/sounds";

interface FallingItem {
  id: number;
  emoji: string;
  x: number;
  y: number;
  speed: number;
  type: "burger" | "junk" | "veggie" | "powerup";
  points: number;
}

const BURGERS = ["🍔"];
const JUNK_FOOD = ["🍕", "🌭", "🍟", "🍩", "🍪", "🧁", "🍫", "🍭"];
const VEGGIES = ["🥦", "🥕", "🥬", "🍅", "🥒", "🌽"];

const GAME_SPEED = 16;
const MAX_SPEED_CAP = 1.2;

const Game = () => {
  const [score, setScore] = useState(0);
  const [catcherX, setCatcherX] = useState(50);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem("catchGameHighScore");
    return saved ? parseInt(saved) : 0;
  });
  const [missed, setMissed] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [powered, setPowered] = useState(false);
  const [powerTimer, setPowerTimer] = useState(0);
  const idCounter = useRef(0);
  const gameArea = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const catcherXRef = useRef(50);
  const poweredRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { poweredRef.current = powered; }, [powered]);
  useEffect(() => { catcherXRef.current = catcherX; }, [catcherX]);

  // Difficulty scales with score
  const difficulty = Math.floor(score / 15);
  const spawnRate = Math.max(25, 60 - difficulty * 5);
  const baseSpeed = Math.min(MAX_SPEED_CAP, 0.3 + difficulty * 0.08);
  const moveSpeed = powered ? 3 : 1.5;

  const spawnItem = useCallback(() => {
    const rand = Math.random();
    let emoji: string, type: FallingItem["type"], points: number;

    const spawnX = 5 + Math.random() * 85;

    // 1% chance for power-up
    if (rand < 0.01) {
      return {
        id: idCounter.current++,
        emoji: "⚡",
        x: spawnX,
        y: -5,
        speed: Math.min(MAX_SPEED_CAP, baseSpeed + Math.random() * 0.3),
        type: "powerup" as const,
        points: 0,
      };
    }

    if (rand < 0.2) {
      emoji = BURGERS[0];
      type = "burger";
      points = 5;
    } else if (rand < 0.6) {
      emoji = JUNK_FOOD[Math.floor(Math.random() * JUNK_FOOD.length)];
      type = "junk";
      points = 1;
    } else {
      emoji = VEGGIES[Math.floor(Math.random() * VEGGIES.length)];
      type = "veggie";
      points = -3;
    }

    return {
      id: idCounter.current++,
      emoji,
      x: spawnX,
      y: -5,
      speed: Math.min(MAX_SPEED_CAP, baseSpeed + Math.random() * 0.4),
      type,
      points,
    };
  }, [baseSpeed]);

  const activatePowerUp = useCallback(() => {
    setPowered(true);
    setPowerTimer(10);
  }, []);

  // Power-up countdown
  useEffect(() => {
    if (!powered) return;
    const iv = setInterval(() => {
      setPowerTimer((t) => {
        if (t <= 1) {
          setPowered(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [powered]);

  const resetGame = () => {
    setScore(0);
    setItems([]);
    setGameOver(false);
    setMissed(0);
    setCatcherX(50);
    setPowered(false);
    setPowerTimer(0);
    setStarted(true);
    startBgm();
  };

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (!started && !gameOver) {
        setStarted(true);
        startBgm();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [started, gameOver]);

  // Touch input
  useEffect(() => {
    const area = gameArea.current;
    if (!area) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = area.getBoundingClientRect();
      const touchX = e.touches[0].clientX - rect.left;
      const pct = (touchX / rect.width) * 100;
      setCatcherX(Math.max(5, Math.min(95, pct)));
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!started && !gameOver) {
        setStarted(true);
        startBgm();
      }
      handleTouchMove(e);
    };

    area.addEventListener("touchstart", handleTouchStart, { passive: false });
    area.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      area.removeEventListener("touchstart", handleTouchStart);
      area.removeEventListener("touchmove", handleTouchMove);
    };
  }, [started, gameOver]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver) return;

    let spawnTimer = 0;
    const interval = setInterval(() => {
      // Move catcher
      setCatcherX((prev) => {
        let next = prev;
        if (keysPressed.current.has("ArrowLeft") || keysPressed.current.has("a")) next -= moveSpeed;
        if (keysPressed.current.has("ArrowRight") || keysPressed.current.has("d")) next += moveSpeed;
        return Math.max(5, Math.min(95, next));
      });

      spawnTimer++;
      if (spawnTimer > spawnRate) {
        spawnTimer = 0;
        setItems((prev) => [...prev, spawnItem()]);
      }

      setItems((prev) => {
        const next: FallingItem[] = [];
        let newMissed = 0;
        prev.forEach((item) => {
          const updated = { ...item, y: item.y + item.speed };
          if (updated.y > 100) {
            if (item.type !== "veggie" && item.type !== "powerup") {
              if (!poweredRef.current) {
                newMissed++;
              }
            }
          } else {
            next.push(updated);
          }
        });
        if (newMissed > 0) {
          setMissed((m) => m + newMissed);
          playFartSound();
        }
        return next;
      });
    }, GAME_SPEED);

    return () => clearInterval(interval);
  }, [started, gameOver, spawnItem, spawnRate, moveSpeed]);

   // Collision detection — runs in game loop, uses ref for catcher position
  useEffect(() => {
    if (!started || gameOver) return;

    const checkInterval = setInterval(() => {
      const cx = catcherXRef.current;
      setItems((prev) => {
        const remaining: FallingItem[] = [];
        let pointsGained = 0;
        let gotPowerUp = false;
        prev.forEach((item) => {
          const catcherLeft = cx - 6;
          const catcherRight = cx + 6;
          const itemHalf = 2;
          if (
            item.y >= 82 && item.y <= 96 &&
            item.x + itemHalf >= catcherLeft &&
            item.x - itemHalf <= catcherRight
          ) {
            if (item.type === "powerup") {
              gotPowerUp = true;
            } else {
              pointsGained += item.points;
              playEatSound(item.points > 0);
            }
            setFlash(item.type === "powerup" ? "gold" : item.points > 0 ? "green" : "red");
            setTimeout(() => setFlash(null), 200);
          } else {
            remaining.push(item);
          }
        });
        if (pointsGained !== 0) {
          setScore((s) => s + pointsGained);
        }
        if (gotPowerUp) {
          activatePowerUp();
        }
        return remaining;
      });
    }, GAME_SPEED);

    return () => clearInterval(checkInterval);
  }, [started, gameOver, activatePowerUp]);

  // Game over when too many missed
  useEffect(() => {
    if (missed >= 10 && started) {
      setGameOver(true);
      stopBgm();
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem("catchGameHighScore", score.toString());
      }
    }
  }, [missed, started, score, highScore]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background select-none overflow-hidden">
      {/* HUD */}
      <div className="w-full max-w-lg flex justify-between items-center px-4 py-2 text-foreground font-bold text-lg">
        <span>⭐ {score}</span>
        <span className="text-muted-foreground text-sm">🏆 {highScore}</span>
        {powered && (
          <span className="text-yellow-400 text-sm animate-pulse">⚡ {powerTimer}s</span>
        )}
        <span className="text-secondary text-sm">💔 {missed}/10</span>
      </div>

      {/* Game Area */}
      <div
        ref={gameArea}
        className="relative w-full max-w-lg bg-card rounded-xl overflow-hidden border border-border"
        style={{ height: "70vh", touchAction: "none" }}
      >
        {/* Sky gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: powered
              ? "linear-gradient(180deg, hsl(45 80% 20%) 0%, hsl(30 60% 15%) 60%, hsl(220 20% 12%) 100%)"
              : "linear-gradient(180deg, hsl(220 30% 15%) 0%, hsl(250 20% 25%) 60%, hsl(220 20% 12%) 100%)",
          }}
        />

        {/* Stars */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-foreground/20"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 50}%`,
            }}
          />
        ))}

        {/* Ground */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[8%]"
          style={{ background: "linear-gradient(0deg, hsl(120 30% 20%), hsl(120 25% 30%))" }}
        />

        {/* Falling items */}
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute text-3xl transition-none"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: "translate(-50%, -50%)",
              filter:
                item.type === "powerup"
                  ? "drop-shadow(0 0 10px hsl(45 100% 60% / 0.9))"
                  : item.type === "burger"
                  ? "drop-shadow(0 0 8px hsl(45 100% 55% / 0.6))"
                  : undefined,
            }}
          >
            {item.emoji}
          </div>
        ))}

        {/* Catcher */}
        <div
          className="absolute text-5xl transition-none"
          style={{
            left: `${catcherX}%`,
            bottom: "6%",
            transform: "translateX(-50%)",
            filter: powered
              ? "drop-shadow(0 0 16px hsl(45 100% 55% / 0.9))"
              : flash === "green"
              ? "drop-shadow(0 0 12px hsl(160 60% 45% / 0.8))"
              : flash === "red"
              ? "drop-shadow(0 0 12px hsl(0 84% 60% / 0.8))"
              : flash === "gold"
              ? "drop-shadow(0 0 16px hsl(45 100% 55% / 0.9))"
              : "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        >
          {powered ? "🦸" : "🧒"}
        </div>

        {/* Start screen */}
        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <div className="text-6xl mb-4">🧒🍔</div>
            <h1 className="text-3xl font-black text-primary mb-2">Junk Food Catcher!</h1>
            <p className="text-muted-foreground text-center px-8 mb-1">
              Catch burgers for <span className="text-primary font-bold">5pts</span>, junk food for <span className="text-primary font-bold">1pt</span>
            </p>
            <p className="text-secondary text-center px-8 mb-1">
              Avoid veggies! <span className="font-bold">-3pts</span> 🥦
            </p>
            <p className="text-yellow-400 text-center px-8 mb-6">
              Catch ⚡ for super speed & invincibility!
            </p>
            <p className="text-muted-foreground animate-pulse">
              ← → or touch to play
            </p>
          </div>
        )}

        {/* Game over screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 z-10">
            <div className="text-5xl mb-4">😵</div>
            <h2 className="text-3xl font-black text-secondary mb-2">Game Over!</h2>
            <p className="text-2xl text-primary font-bold mb-1">Score: {score}</p>
            {score >= highScore && score > 0 && (
              <p className="text-accent font-bold mb-4">🏆 New High Score!</p>
            )}
            <button
              onClick={resetGame}
              onTouchEnd={(e) => { e.stopPropagation(); resetGame(); }}
              className="mt-4 px-8 py-3 bg-primary text-primary-foreground font-bold rounded-lg text-lg hover:opacity-90 transition-opacity"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
        <span>🍔 +5</span>
        <span>🍕 +1</span>
        <span>🥦 -3</span>
        <span>⚡ Power!</span>
      </div>
    </div>
  );
};

export default Game;
