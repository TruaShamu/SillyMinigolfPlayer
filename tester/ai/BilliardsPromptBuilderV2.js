/**
 * Billiards Prompt Builder V2 - Optimized for Ollama/LocalLLM
 * Includes calculator baseline and style-specific power guidance
 */
export class BilliardsPromptBuilderV2 {
    constructor(personality) {
        this.personality = personality;
    }

    /**
     * Build billiards prompt with baseline and power guidance
     * @param {Object} context - Game state, layout, baseline shot
     * @returns {string} Prompt text
     */
    buildPrompt(context) {
        const { gameState, courseLayout, baselineShot, sessionLog = [] } = context;
        const state = gameState || {};
        const ball = state.ball || {};
        const emotion = this.personality?.getEmotionalState?.() || 'calm';
        const style = this.personality?.playStyle?.name || 'strategic';
        const confidence = Math.round((this.personality?.confidence || 0.5) * 100);
        const layout = courseLayout || {};

        // Shot history compact format
        const shotHistory = sessionLog.slice(-5)
            .map(log => `T${log.turn}:${log.state?.won ? '✓' : '✗'}`)
            .join(' ');

        // Behavior guide and power range
        const { behaviorGuide, powerRange } = this._getBehaviorGuide(style);

        // Baseline suggestion
        let baselineSuggestion = '';
        if (baselineShot) {
            baselineSuggestion = `\nBaseline: angle=${baselineShot.angle?.toFixed(1) || '?'}°, power=${baselineShot.power?.toFixed(1) || '?'}`;
        }

        // Game context
        const targets = state.targetBallAnalysis || [];
        const easiestTarget = targets.length > 0 ? targets[0] : null;
        let gameContext = `Sunk: ${state.sunkBalls?.length || 0} | Available targets: ${targets.length}`;
        if (easiestTarget) {
            gameContext += ` | Easiest dist: ${easiestTarget.distanceFromCue?.toFixed(1) || '?'}`;
        }

        return `BILLIARDS DECISION - RETURN ONLY JSON, NO EXPLANATION
Ball: (${ball.x?.toFixed(1) || '?'}, ${ball.z?.toFixed(1) || '?'})
Available targets: ${state.targetBallAnalysis?.length || 0}
Course: ${layout.name || 'unknown'} (${layout.walls?.length || 0} walls, ${layout.obstacles?.length || 0} obstacles)
Game state: ${gameContext}
Recent: ${shotHistory || 'none'}

Personality: ${style}, feeling ${emotion} (${confidence}% confident)
Strategy: ${behaviorGuide}${baselineSuggestion}

POWER SCALE: 0=no power, 60=medium, 100+=maximum force
POWER RANGE FOR YOUR STYLE: ${powerRange}

COMMENTARY: Keep it humorous and MAX 15 WORDS. Must reflect your ${style} personality (e.g., aggressive=confident, chaotic=wild, cautious=nervous, perfectionist=precise, strategic=tactical).

OUTPUT ONLY THIS JSON - NO TEXT BEFORE OR AFTER:
{"angle": NUMBER_HERE, "power": NUMBER_HERE, "commentary": "humorous one-liner max 15 words"}`;
    }

    /**
     * Get behavior guide and power range for personality style
     * @private
     */
    _getBehaviorGuide(style) {
        const guides = {
            aggressive: {
                behaviorGuide: 'Go for difficult shots, maximum power to move balls across table.',
                powerRange: '60-100+ (aggressive billiards needs high power)'
            },
            chaotic: {
                behaviorGuide: 'Ignore strategy, try crazy angles and wild power.',
                powerRange: '20-120 (anything goes)'
            },
            cautious: {
                behaviorGuide: 'Hit easiest target with safe power.',
                powerRange: '30-60 (safe shots)'
            },
            perfectionist: {
                behaviorGuide: 'Optimal target and optimal power.',
                powerRange: '50-80 (balanced and precise)'
            },
            strategic: {
                behaviorGuide: 'Balanced target and power, think two shots ahead.',
                powerRange: '50-80 (balanced)'
            }
        };

        return guides[style] || guides.strategic;
    }
}

export default BilliardsPromptBuilderV2;
