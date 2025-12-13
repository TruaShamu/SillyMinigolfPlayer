// Refactored 2D Golf/Billiards Game - Clean Architecture
import { LevelLoader } from './core/LevelLoader.js';
import { MinigolfParadigm } from './core/MinigolfParadigm.js';
import { BilliardsParadigm } from './core/BilliardsParadigm.js';
import { Physics } from './core/Physics.js';
import { AICompanionUI } from './ai-companion-ui.js';

(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const aiUI = new AICompanionUI();
    
    canvas.width = 360;
    canvas.height = 720;

    // World coordinate system
    const worldBounds = { minX: -7, maxX: 7, minY: -8, maxY: 8 };
    
    // Coordinate conversion
    function worldToScreen(wx, wy) {
        const worldWidth = worldBounds.maxX - worldBounds.minX;
        const worldHeight = worldBounds.maxY - worldBounds.minY;
        const sx = ((wx - worldBounds.minX) / worldWidth) * canvas.width;
        const sy = ((wy - worldBounds.minY) / worldHeight) * canvas.height;
        return { x: sx, y: sy };
    }
    
    function screenToWorld(sx, sy) {
        const worldWidth = worldBounds.maxX - worldBounds.minX;
        const worldHeight = worldBounds.maxY - worldBounds.minY;
        const wx = (sx / canvas.width) * worldWidth + worldBounds.minX;
        const wy = (sy / canvas.height) * worldHeight + worldBounds.minY;
        return { x: wx, y: wy };
    }

    // Game state
    let level = null;
    let paradigm = null;
    let gameTime = 60;
    let strokes = 0;
    let gameOver = false;
    let won = false;
    let ball = { x: 0, y: 0, radius: 12 };
    let velocity = { x: 0, y: 0 };
    let previousBallPos = null; // Track previous position for swept collision
    let dynamicBalls = [];
    let sunkBalls = [];
    let isDragging = false;
    let aimStartWorld = null;
    let lastPointerX = 0, lastPointerY = 0;
    let courseRenderData = { floors: [], walls: [], obstacles: [] };
    let frameLog = [];
    let frameCount = 0;
    const MAX_FRAME_LOG_SIZE = 600;

    // Level loader
    const levelLoader = new LevelLoader('./courses/');

    // Telemetry API for AI
    window.gameState = {
        getBallPosition: () => ({ x: ball.x, z: ball.y }),
        getHolePosition: () => level ? { x: level.getMainHole().x, z: level.getMainHole().z } : { x: 0, z: 0 },
        getBallVelocity: () => ({ x: velocity.x, z: velocity.y }),
        isBallMoving: () => Math.abs(velocity.x) > 0.05 || Math.abs(velocity.y) > 0.05 || 
                           dynamicBalls.some(b => Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05),
        getStrokes: () => strokes,
        getTimeRemaining: () => gameTime,
        isGameOver: () => gameOver,
        hasWon: () => won,
        getDynamicBallsCount: () => dynamicBalls.length,
        getSunkBalls: () => sunkBalls.slice(),
        isBilliardsMode: () => paradigm && paradigm.getModeName() === 'billiards',
        getPockets: () => level ? level.getPockets().map(p => ({ x: p.x, z: p.z, radius: p.radius, id: p.id })) : [],
        getFullState: () => ({
            ball: { x: ball.x, z: ball.y },
            hole: level ? { x: level.getMainHole().x, z: level.getMainHole().z } : { x: 0, z: 0 },
            pockets: level ? level.getPockets().map(p => ({ x: p.x, z: p.z, radius: p.radius, id: p.id })) : [],
            velocity: { x: velocity.x, z: velocity.y },
            dynamicBalls: dynamicBalls.map(b => ({ x: b.x, z: b.y, vx: b.vx, vy: b.vy, id: b.id, color: b.color })),
            sunkBalls: sunkBalls.slice(),
            isMoving: Math.abs(velocity.x) > 0.05 || Math.abs(velocity.y) > 0.05 || dynamicBalls.some(b => Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05),
            strokes,
            timeRemaining: gameTime,
            gameOver,
            won,
            distanceToHole: level ? Physics.distance({ x: ball.x, z: ball.y }, { x: level.getMainHole().x, z: level.getMainHole().z }) : 0,
            targetBallAnalysis: paradigm && paradigm.getModeName() === 'billiards' ? analyzeTargetBalls() : []
        }),
        getFrameLog: () => [...frameLog],
        getRecentFrames: (n = 60) => frameLog.slice(-n),
        worldToScreen: (worldX, worldZ) => worldToScreen(worldX, worldZ),
        screenToWorld: (screenX, screenY) => { const w = screenToWorld(screenX, screenY); return { x: w.x, z: w.y }; },
        getCourseLayout: () => level ? level.toJSON() : null,
        updateCompanionUI: (personalityState, shotDecision) => {
            aiUI.show();
            aiUI.updateDecision(personalityState, { ...shotDecision, timestamp: Date.now() });
        },
        courseLoaded: false
    };

    function analyzeTargetBalls() {
        if (!level || !paradigm || paradigm.getModeName() !== 'billiards') return [];
        
        const pockets = level.getPockets();
        if (pockets.length === 0) return [];
        
        return dynamicBalls.map(b => {
            const pocketDistances = pockets.map(p => ({
                pocketId: p.id,
                distance: Physics.distance({ x: b.x, z: b.y }, { x: p.x, z: p.z }),
                angle: Math.atan2(p.z - b.y, p.x - b.x) * 180 / Math.PI,
                position: { x: p.x, z: p.z }
            })).sort((a, b) => a.distance - b.distance);
            
            const nearestPocket = pocketDistances[0];
            const distFromCue = Physics.distance({ x: ball.x, z: ball.y }, { x: b.x, z: b.y });
            
            return {
                id: b.id,
                color: b.color,
                position: { x: b.x, z: b.y },
                distanceFromCue: distFromCue,
                nearestPocket: nearestPocket,
                allPocketDistances: pocketDistances,
                bestPockets: pocketDistances.slice(0, 3),
                difficulty: nearestPocket.distance + distFromCue * 0.5
            };
        }).sort((a, b) => a.difficulty - b.difficulty);
    }

    function logFrame() {
        frameLog.push({
            frame: frameCount++,
            time: performance.now(),
            ball: { x: ball.x, y: ball.y },
            velocity: { x: velocity.x, y: velocity.y },
            speed: Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y),
            isMoving: Math.abs(velocity.x) > 0.05 || Math.abs(velocity.y) > 0.05,
            strokes,
            gameOver,
            won,
            dynamicBalls: dynamicBalls.map(b => ({
                id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
                speed: Math.sqrt(b.vx * b.vx + b.vy * b.vy)
            }))
        });
        
        if (frameLog.length > MAX_FRAME_LOG_SIZE) frameLog.shift();
    }

    async function startLevel(levelId) {
        try {
            level = await levelLoader.loadLevel(levelId);
            
            // Create paradigm
            if (level.paradigm === 'billiards') {
                paradigm = new BilliardsParadigm();
            } else {
                paradigm = new MinigolfParadigm();
            }
            
            // Reset game state
            gameTime = 60;
            strokes = 0;
            gameOver = false;
            won = false;
            velocity = { x: 0, y: 0 };
            sunkBalls = [];
            frameLog = [];
            frameCount = 0;
            
            // Setup ball and hole
            ball.x = level.startPosition.x;
            ball.y = level.startPosition.z;
            
            // Setup dynamic balls (billiards targets)
            dynamicBalls = level.dynamicObjects.map(obj => ({
                x: obj.x,
                y: obj.z,
                vx: 0,
                vy: 0,
                radius: obj.radius,
                color: obj.color,
                id: obj.id
            }));
            
            // Convert to screen coordinates for rendering
            courseRenderData.floors = (level.buildFloors || []).map(f => {
                const tl = worldToScreen(f.x - f.width / 2, f.z - f.depth / 2);
                const br = worldToScreen(f.x + f.width / 2, f.z + f.depth / 2);
                return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
            });
            
            courseRenderData.walls = (level.buildWalls || []).map(w => {
                const tl = worldToScreen(w.x - w.w / 2, w.z - w.d / 2);
                const br = worldToScreen(w.x + w.w / 2, w.z + w.d / 2);
                return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y,
                        worldX: w.x, worldY: w.z, worldW: w.w, worldD: w.d, name: w.name };
            });
            
            courseRenderData.obstacles = (level.buildObstacles || [])
                .filter(obs => !level.dynamicObjects.find(d => d.id === obs.name))
                .map(obs => {
                    const screen = worldToScreen(obs.x, obs.z);
                    const radiusScreen = (obs.radius / (worldBounds.maxX - worldBounds.minX)) * canvas.width;
                    return { x: screen.x, y: screen.y, radius: radiusScreen,
                            worldX: obs.x, worldY: obs.z, worldRadius: obs.radius };
                });
            
            window.gameState.courseLoaded = true;
            
            // Start game loop
            requestAnimationFrame(gameLoop);
            
        } catch (error) {
            console.error('Failed to load level:', error);
        }
    }

    // Input handling
    canvas.addEventListener('pointermove', (evt) => {
        lastPointerX = evt.offsetX;
        lastPointerY = evt.offsetY;
    });
    
    canvas.addEventListener('pointerdown', (evt) => {
        lastPointerX = evt.offsetX;
        lastPointerY = evt.offsetY;
        if (!gameOver && !window.gameState.isBallMoving()) {
            isDragging = true;
            aimStartWorld = screenToWorld(lastPointerX, lastPointerY);
            canvas.setPointerCapture(evt.pointerId);
        }
    });
    
    canvas.addEventListener('pointerup', (evt) => {
        if (isDragging && aimStartWorld) {
            const endWorld = screenToWorld(lastPointerX, lastPointerY);
            executeShot(aimStartWorld, endWorld);
            isDragging = false;
            aimStartWorld = null;
            canvas.releasePointerCapture(evt.pointerId);
        }
    });

    function executeShot(start, end) {
        const dx = start.x - end.x;
        const dy = start.y - end.y;
        const power = Math.sqrt(dx * dx + dy * dy) * 2;
        const clampedPower = Math.min(power, paradigm.getMaxPower());
        
        const angle = Math.atan2(dy, dx);
        velocity.x = Math.cos(angle) * clampedPower;
        velocity.y = Math.sin(angle) * clampedPower;
        
        strokes++;
    }

    let lastTime = 0;

    function gameLoop(timestamp) {
        if (!lastTime) {
            lastTime = timestamp;
            requestAnimationFrame(gameLoop);
            return;
        }

        const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
        lastTime = timestamp;

        if (!gameOver && paradigm) {
            // No time limit for minigolf - only win condition is reaching the hole
            
            // Update physics
            if (window.gameState.isBallMoving()) {
                // Store previous position for swept collision detection
                previousBallPos = { x: ball.x, y: ball.y };
                
                // Player ball
                ball.x += velocity.x * dt;
                ball.y += velocity.y * dt;
                
                // Dynamic balls
                dynamicBalls.forEach(b => {
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    const frameFriction = Math.pow(paradigm.getFriction(), dt * 60);
                    b.vx *= frameFriction;
                    b.vy *= frameFriction;
                    if (Math.abs(b.vx) < 0.01) b.vx = 0;
                    if (Math.abs(b.vy) < 0.01) b.vy = 0;
                });

                // Collisions
                checkWallCollisions();
                checkObstacleCollisions();
                checkBallBallCollisions();

                // Friction
                const frameFriction = Math.pow(paradigm.getFriction(), dt * 60);
                velocity.x *= frameFriction;
                velocity.y *= frameFriction;
                if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
                if (Math.abs(velocity.y) < 0.01) velocity.y = 0;
            }

            logFrame();

            // Check win/lose conditions
            checkGoalConditions();
        }

        render();
        requestAnimationFrame(gameLoop);
    }

    function checkGoalConditions() {
        if (!paradigm || !level) return;

        // Check if ball is in a hole/pocket
        const holes = level.holes;
        const ballRadius = paradigm.getBallRadius();
        for (const hole of holes) {
            const dist = Physics.distance({ x: ball.x, z: ball.y }, { x: hole.x, z: hole.z });
            const sinkThreshold = paradigm.getModeName() === 'billiards' ? hole.radius + ballRadius : hole.radius * 0.9;
            
            // Direct check: ball is in hole
            if (dist < sinkThreshold) {
                if (paradigm.shouldSinkCueBall()) {
                    // Minigolf: Win!
                    gameOver = true;
                    won = true;
                    velocity.x = 0;
                    velocity.y = 0;
                } else {
                    // Billiards: Place cue ball at pocket edge (forgiving)
                    const dx = ball.x - hole.x;
                    const dy = ball.y - hole.z;
                    const distToPocket = Math.sqrt(dx * dx + dy * dy);
                    if (distToPocket > 0.01) {
                        const safeDistance = hole.radius + ballRadius + 0.2; // Slightly outside pocket
                        ball.x = hole.x + (dx / distToPocket) * safeDistance;
                        ball.y = hole.z + (dy / distToPocket) * safeDistance;
                    } else {
                        // Ball is exactly at center, push it to the right
                        ball.x = hole.x + hole.radius + ballRadius + 0.2;
                        ball.y = hole.z;
                    }
                    velocity.x = 0;
                    velocity.y = 0;
                }
                break;
            }
            
            // Swept check: did ball pass through hole since last frame?
            // Check if trajectory from last position to current intersects hole
            if (previousBallPos && Physics.lineCircleIntersection(
                { x: previousBallPos.x, z: previousBallPos.y },
                { x: ball.x, z: ball.y },
                { x: hole.x, z: hole.z },
                sinkThreshold
            )) {
                // Ball passed through hole, snap it in
                ball.x = hole.x;
                ball.y = hole.z;
                if (paradigm.shouldSinkCueBall()) {
                    gameOver = true;
                    won = true;
                } else {
                    // Billiards: place at pocket edge
                    ball.x = hole.x + hole.radius + ballRadius + 0.2;
                    ball.y = hole.z;
                }
                velocity.x = 0;
                velocity.y = 0;
                break;
            }
        }

        // Check dynamic balls in holes
        for (let i = dynamicBalls.length - 1; i >= 0; i--) {
            const b = dynamicBalls[i];
            for (const hole of holes) {
                const dist = Physics.distance({ x: b.x, z: b.y }, { x: hole.x, z: hole.z });
                const sinkThreshold = paradigm.getModeName() === 'billiards' ? hole.radius + b.radius : hole.radius * 0.9;
                
                if (dist < sinkThreshold) {
                    sunkBalls.push({ ...b, sunkAtStroke: strokes });
                    dynamicBalls.splice(i, 1);
                    break;
                }
            }
        }

        // Check win condition using paradigm
        if (paradigm.isWinCondition({ 
            won, 
            dynamicBalls, 
            sunkBalls,
            timeRemaining: gameTime 
        })) {
            gameOver = true;
            won = true;
        }

        // Check lose condition using paradigm
        if (paradigm.isLoseCondition({
            won,
            timeRemaining: gameTime,
            dynamicBalls,
            sunkBalls
        })) {
            gameOver = true;
            won = false;
        }
    }

    function checkWallCollisions() {
        const r = paradigm ? paradigm.getBallRadius() : 0.3;

        // Player ball
        courseRenderData.walls.forEach(wall => {
            const halfW = wall.worldW / 2;
            const halfD = wall.worldD / 2;
            const closestX = Math.max(wall.worldX - halfW, Math.min(ball.x, wall.worldX + halfW));
            const closestY = Math.max(wall.worldY - halfD, Math.min(ball.y, wall.worldY + halfD));
            
            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < r && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                ball.x = closestX + nx * r;
                ball.y = closestY + ny * r;
                
                const dot = velocity.x * nx + velocity.y * ny;
                velocity.x = (velocity.x - 2 * dot * nx) * 0.8;
                velocity.y = (velocity.y - 2 * dot * ny) * 0.8;
            }
        });

        // Dynamic balls
        dynamicBalls.forEach(b => {
            courseRenderData.walls.forEach(wall => {
                const halfW = wall.worldW / 2;
                const halfD = wall.worldD / 2;
                const closestX = Math.max(wall.worldX - halfW, Math.min(b.x, wall.worldX + halfW));
                const closestY = Math.max(wall.worldY - halfD, Math.min(b.y, wall.worldY + halfD));
                
                const dx = b.x - closestX;
                const dy = b.y - closestY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < b.radius && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    b.x = closestX + nx * b.radius;
                    b.y = closestY + ny * b.radius;
                    
                    const dot = b.vx * nx + b.vy * ny;
                    b.vx = (b.vx - 2 * dot * nx) * 0.8;
                    b.vy = (b.vy - 2 * dot * ny) * 0.8;
                }
            });
        });
    }

    function checkObstacleCollisions() {
        const r = paradigm ? paradigm.getBallRadius() : 0.3;

        // Player ball vs obstacles
        if (courseRenderData.obstacles && courseRenderData.obstacles.length > 0) {
            courseRenderData.obstacles.forEach(obstacle => {
                const dx = ball.x - obstacle.worldX;
                const dy = ball.y - obstacle.worldY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = r + obstacle.worldRadius;
                
                if (dist < minDist && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    ball.x = obstacle.worldX + nx * minDist;
                    ball.y = obstacle.worldY + ny * minDist;
                    
                    const dot = velocity.x * nx + velocity.y * ny;
                    velocity.x = (velocity.x - 2 * dot * nx) * 0.8;
                    velocity.y = (velocity.y - 2 * dot * ny) * 0.8;
                }
            });
        }

        // Dynamic balls vs obstacles
        dynamicBalls.forEach(b => {
            if (courseRenderData.obstacles && courseRenderData.obstacles.length > 0) {
                courseRenderData.obstacles.forEach(obstacle => {
                    const dx = b.x - obstacle.worldX;
                    const dy = b.y - obstacle.worldY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = b.radius + obstacle.worldRadius;
                    
                    if (dist < minDist && dist > 0) {
                        const nx = dx / dist;
                        const ny = dy / dist;
                        b.x = obstacle.worldX + nx * minDist;
                        b.y = obstacle.worldY + ny * minDist;
                        
                        const dot = b.vx * nx + b.vy * ny;
                        b.vx = (b.vx - 2 * dot * nx) * 0.8;
                        b.vy = (b.vy - 2 * dot * ny) * 0.8;
                    }
                });
            }
        });
    }

    function checkBallBallCollisions() {
        const r = paradigm ? paradigm.getBallRadius() : 0.3;

        // Player vs dynamic
        dynamicBalls.forEach(b => {
            const dx = ball.x - b.x;
            const dy = ball.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = r + b.radius;
            
            if (dist < minDist && dist > 0) {
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                
                ball.x += nx * overlap * 0.5;
                ball.y += ny * overlap * 0.5;
                b.x -= nx * overlap * 0.5;
                b.y -= ny * overlap * 0.5;
                
                // Elastic collision
                const v1n = velocity.x * nx + velocity.y * ny;
                const v1t = -velocity.x * ny + velocity.y * nx;
                const v2n = b.vx * nx + b.vy * ny;
                const v2t = -b.vx * ny + b.vy * nx;
                
                velocity.x = v2n * nx - v1t * ny;
                velocity.y = v2n * ny + v1t * nx;
                b.vx = v1n * nx - v2t * ny;
                b.vy = v1n * ny + v2t * nx;
            }
        });

        // Dynamic vs dynamic
        for (let i = 0; i < dynamicBalls.length; i++) {
            for (let j = i + 1; j < dynamicBalls.length; j++) {
                const b1 = dynamicBalls[i];
                const b2 = dynamicBalls[j];
                const dx = b1.x - b2.x;
                const dy = b1.y - b2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = b1.radius + b2.radius;
                
                if (dist < minDist && dist > 0) {
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    b1.x += nx * overlap * 0.5;
                    b1.y += ny * overlap * 0.5;
                    b2.x -= nx * overlap * 0.5;
                    b2.y -= ny * overlap * 0.5;
                    
                    const v1n = b1.vx * nx + b1.vy * ny;
                    const v1t = -b1.vx * ny + b1.vy * nx;
                    const v2n = b2.vx * nx + b2.vy * ny;
                    const v2t = -b2.vx * ny + b2.vy * nx;
                    
                    b1.vx = v2n * nx - v1t * ny;
                    b1.vy = v2n * ny + v1t * nx;
                    b2.vx = v1n * nx - v2t * ny;
                    b2.vy = v1n * ny + v2t * nx;
                }
            }
        }
    }

    function render() {
        // Clear
        ctx.fillStyle = '#265a26';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Floors
        ctx.fillStyle = '#338833';
        courseRenderData.floors.forEach(f => ctx.fillRect(f.x, f.y, f.width, f.height));

        // Holes/Pockets
        if (level) {
            ctx.fillStyle = '#000000';
            level.holes.forEach(hole => {
                const screen = worldToScreen(hole.x, hole.z);
                const radius = (hole.radius / (worldBounds.maxX - worldBounds.minX)) * canvas.width;
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Walls
        ctx.fillStyle = '#8b5a2b';
        courseRenderData.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.width, w.height);
        });

        // Obstacles
        ctx.fillStyle = '#886644';
        courseRenderData.obstacles.forEach(obs => {
            ctx.beginPath();
            ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Dynamic balls
        dynamicBalls.forEach(b => {
            const screen = worldToScreen(b.x, b.y);
            const radius = (b.radius / (worldBounds.maxX - worldBounds.minX)) * canvas.width;
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Player ball
        const ballScreen = worldToScreen(ball.x, ball.y);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ballScreen.x, ballScreen.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Aim line
        if (isDragging && aimStartWorld) {
            const ballScr = worldToScreen(ball.x, ball.y);
            const startScr = worldToScreen(aimStartWorld.x, aimStartWorld.y);
            let dragX = startScr.x - lastPointerX;
            let dragY = startScr.y - lastPointerY;
            
            const currentWorld = screenToWorld(lastPointerX, lastPointerY);
            const dx = aimStartWorld.x - currentWorld.x;
            const dy = aimStartWorld.y - currentWorld.y;
            const rawPower = Math.sqrt(dx * dx + dy * dy) * 2;
            const maxPower = paradigm ? paradigm.getMaxPower() : 30;
            
            if (rawPower > maxPower) {
                const scale = maxPower / rawPower;
                dragX *= scale;
                dragY *= scale;
            }
            
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ballScr.x, ballScr.y);
            ctx.lineTo(ballScr.x + dragX, ballScr.y + dragY);
            ctx.stroke();
        }

        // UI
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        
        if (paradigm && paradigm.getModeName() === 'minigolf') {
            const mins = Math.floor(gameTime / 60);
            const secs = Math.floor(gameTime % 60);
            ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, canvas.width / 2, 50);
        }
        
        ctx.fillText(`Strokes: ${strokes}`, canvas.width / 2, 85);
        
        if (paradigm && paradigm.getModeName() === 'billiards' && dynamicBalls.length > 0) {
            ctx.fillText(`Balls: ${dynamicBalls.length}`, canvas.width / 2, 115);
        }

        if (gameOver) {
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = won ? '#00ff00' : '#ff4444';
            ctx.fillText(paradigm ? (won ? paradigm.getWinMessage({ strokes }) : paradigm.getLoseMessage({ timeRemaining: gameTime })) : 'Game Over', canvas.width / 2, canvas.height / 2);
        }
    }

    // Load initial level
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('course') || 'l-shape';
    startLevel(courseId);

})();
