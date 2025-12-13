/**
 * Minigolf-specific Prompt Builder
 */
export class MinigolfPromptBuilder {
    constructor() {}

    /**
     * Build minigolf-specific prompt
     */
    buildPrompt(context) {
        const { gameState, courseLayout, shotHistory, physicsObservations, personalityContext } = context;
        
        return `# MINIGOLF GAME

## RULES:
- Get the ball into the hole
- Minimize number of strokes
- Avoid walls (they bounce unpredictably)
- Plan around obstacles

## ANGLE CALCULATION:
IMPORTANT: Use this exact formula to calculate angle to hole:
- dx = hole.x - ball.x
- dz = hole.z - ball.z
- angle = atan2(dz, dx) * 180 / π
- This gives angle in degrees: 0° = right, 90° = up, 180° = left, -90° = down

EXAMPLE: If ball is at (0, 0) and hole is at (5, 5):
- dx = 5 - 0 = 5
- dz = 5 - 0 = 5
- angle = atan2(5, 5) * 180 / π ≈ 45° (up-right direction)

ALWAYS verify: Does your calculated angle point TOWARD the hole?

## POWER SCALING GUIDE:
- Close to hole (< 2 units): Power 15-25 (firm tap)
- Medium distance (2-8 units): Power 30-40 (strong power)
- Far from hole (> 8 units): Power 40-55 (very strong - go for it!)
Adjust based on obstacles and walls in the path! Shoot hard and aggressive!

## CURRENT STATE:
### Ball Position:
- Position: (${gameState.ball.x.toFixed(2)}, ${gameState.ball.z.toFixed(2)})
- Distance to hole: ${gameState.distanceToHole.toFixed(2)} units

### Hole Position:
- Position: (${gameState.hole.x.toFixed(2)}, ${gameState.hole.z.toFixed(2)})

### Game Progress:
- Strokes taken: ${gameState.strokeCount || 0}
- Balls sunk: ${gameState.sunkBalls?.length || 0}
- Game Status: ${gameState.won ? '🎉 YOU WON!' : gameState.gameOver ? '❌ Game Over' : '🎮 In Progress'}

### Course Layout:
- Name: ${courseLayout.name}
- Walls: ${courseLayout.walls?.length || 0}
- Obstacles: ${courseLayout.obstacles?.length || 0}

## SHOT HISTORY:
${this.formatShotHistory(shotHistory)}

## PHYSICS OBSERVATIONS:
${physicsObservations || 'No physics data yet'}

${personalityContext || ''}

## YOUR TASK:
**CRITICAL: Calculate angle using the formula above. Verify it points toward the hole.**

1. Calculate: dx = ${gameState.hole.x.toFixed(2)} - ${gameState.ball.x.toFixed(2)} = ${(gameState.hole.x - gameState.ball.x).toFixed(2)}
2. Calculate: dz = ${gameState.hole.z.toFixed(2)} - ${gameState.ball.z.toFixed(2)} = ${(gameState.hole.z - gameState.ball.z).toFixed(2)}
3. angle = atan2(${(gameState.hole.z - gameState.ball.z).toFixed(2)}, ${(gameState.hole.x - gameState.ball.x).toFixed(2)}) = ?
4. Estimate power needed for distance
5. Check for obstacles in the way

Respond in JSON:
{
    "reasoning": "Show your angle calculation step-by-step",
    "angle": angle_in_degrees,
    "power": power_value,
    "strategy": "direct | bank | careful"
}`;
    }

    /**
     * Format shot history for prompt
     */
    formatShotHistory(shotHistory) {
        if (!shotHistory || shotHistory.length === 0) {
            return '- No shots taken yet';
        }
        
        return shotHistory.slice(-5).map((shot, i) => {
            const result = shot.distanceChange < 0 ? '✅ Closer' : '❌ Further';
            return `${i + 1}. ${shot.strategy || 'attempt'} - ${result} (${shot.distanceChange ? shot.distanceChange.toFixed(1) : 'N/A'}u change)`;
        }).join('\n');
    }
}
