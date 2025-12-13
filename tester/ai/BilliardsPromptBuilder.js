/**
 * Billiards-specific Prompt Builder
 */
export class BilliardsPromptBuilder {
    constructor() {}

    /**
     * Build billiards-specific prompt
     */
    buildPrompt(context) {
        const { gameState, courseLayout, shotHistory, physicsObservations, personalityContext } = context;
        
        return `# BILLIARDS GAME

## RULES:
- Sink all target balls into any of the 6 pockets
- If cue ball goes in pocket, it just stays at pocket edge (no penalty)
- Think 2 shots ahead for positioning
- Choose the best pocket for each target ball
- Consider where cue ball will end up after shot

## COORDINATE SYSTEM:
- X-axis: Negative = left, Positive = right
- Z-axis: Negative = top of screen, Positive = bottom of screen
- Angle: 0° = right (+X), 90° = up (-Z), 180° = left (-X), 270° = down (+Z)
- Use atan2(targetZ - ballZ, targetX - ballX) * 180/PI to calculate angle

## POWER SCALING GUIDE:
Use distance to target ball to determine power. Billiards is physics-heavy, so use STRONG power for rebounds:
- Close targets (< 3 units): Power 10-20 (hit hard for control)
- Medium targets (3-8 units): Power 18-30 (good speed for bounces)
- Far targets (> 8 units): Power 30-45 (maximum power for distance)
Higher power = more rebounds and interactions. Don't be afraid to go hard!

## CURRENT STATE:
### Cue Ball Position:
- Position: (${gameState.ball.x.toFixed(2)}, ${gameState.ball.z.toFixed(2)})

### Target Balls:
${this.formatTargetBalls(gameState)}

### Pockets Available:
${this.formatPockets(gameState)}

### Balls Already Sunk:
${gameState.sunkBalls && gameState.sunkBalls.length > 0 ? 
    gameState.sunkBalls.map(b => `- ${b.id} (${b.color})`).join('\n') : 
    '- None yet'}

### Game Progress:
- Total balls sunk: ${gameState.sunkBalls?.length || 0}/${gameState.totalBalls || 'unknown'}
- Game Status: ${gameState.won ? '🎉 YOU WON!' : gameState.gameOver ? '❌ Game Over' : '🎮 In Progress'}

## SHOT HISTORY:
${this.formatShotHistory(shotHistory)}

## PHYSICS OBSERVATIONS:
${physicsObservations || 'No physics data yet'}

${personalityContext || ''}

## YOUR TASK:
1. Choose which target ball to hit
2. Choose which pocket to aim for
3. Calculate power (5-30, higher = further)
4. Consider where cue ball will stop

Respond in JSON:
{
    "reasoning": "Brief 1-sentence explanation",
    "targetBall": "ball_id",
    "targetPocket": "pocket_id",
    "angle": angle_in_degrees,
    "power": power_value
}`;
    }

    /**
     * Format target balls for prompt
     */
    formatTargetBalls(gameState) {
        if (!gameState.targetBallAnalysis || gameState.targetBallAnalysis.length === 0) {
            return '- No target balls remaining (all sunk!)';
        }
        
        return gameState.targetBallAnalysis.map((ball, i) => {
            const difficulty = ball.difficulty.toFixed(1);
            const distFromCue = ball.distanceFromCue.toFixed(1);
            const nearest = ball.nearestPocket;
            const pos = ball.position || { x: 0, z: 0 };
            
            // Calculate angle for display
            const dx = pos.x - gameState.ball.x;
            const dz = pos.z - gameState.ball.z;
            const correctAngle = Math.atan2(dz, dx) * 180 / Math.PI;
            
            return `${i + 1}. ${ball.id} (${ball.color}) at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})
   - ANGLE TO HIT THIS BALL: ${correctAngle.toFixed(1)}°
   - Distance from cue: ${distFromCue} units
   - Nearest pocket: ${nearest.pocketId} at ${nearest.distance.toFixed(1)} units
   - Difficulty score: ${difficulty}
   - Best pockets: ${ball.bestPockets.map(p => `${p.pocketId}(${p.distance.toFixed(1)}u)`).join(', ')}`;
        }).join('\n');
    }

    /**
     * Format pockets for prompt
     */
    formatPockets(gameState) {
        if (!gameState.pockets || gameState.pockets.length === 0) {
            return '- No pockets available';
        }
        
        return gameState.pockets.map(p => 
            `- ${p.id}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) radius ${p.radius.toFixed(1)}`
        ).join('\n');
    }

    /**
     * Format shot history for prompt
     */
    formatShotHistory(shotHistory) {
        if (!shotHistory || shotHistory.length === 0) {
            return '- No shots taken yet';
        }
        
        return shotHistory.slice(-5).map((shot, i) => {
            const result = shot.distanceChange < 0 ? '✅ Improved' : '❌ Worsened';
            return `${i + 1}. ${shot.strategy} - ${result} (${shot.distanceChange.toFixed(1)}u change)`;
        }).join('\n');
    }
}
