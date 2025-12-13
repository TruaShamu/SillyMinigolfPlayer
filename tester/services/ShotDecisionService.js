import { BilliardsShotCalculator } from '../strategy/BilliardsShotCalculator.js';
import { MinigolfShotCalculator } from '../strategy/MinigolfShotCalculator.js';
import { PromptBuilderV2 } from '../ai/PromptBuilderV2.js';

/**
 * ShotDecisionService - Orchestrates shot decisions (LLM or calculator)
 * Detects LLM service type and uses appropriate prompt builder
 */
export class ShotDecisionService {
    constructor(aoaiService, personality, promptBuilder) {
        this.aoaiService = aoaiService;
        this.personality = personality;
        this.promptBuilder = promptBuilder; // Original (AOAI v1)
        
        // Detect if using local LLM (Ollama) or AOAI
        this.isLocalLLM = aoaiService?.constructor?.name === 'LocalLLMService';
        if (this.isLocalLLM) {
            this.promptBuilderV2 = new PromptBuilderV2(personality);
        }
        
        // Don't create calculators yet - wait until personality is set
        this.calculators = null;
        // Cache course layout across shots
        this.courseLayout = null;
    }

    // Lazy initialization of calculators when needed
    _ensureCalculators() {
        if (!this.calculators) {
            this.calculators = {
                billiards: new BilliardsShotCalculator(this.personality),
                minigolf: new MinigolfShotCalculator(this.personality)
            };
        }
    }

    /**
     * Decide next shot using LLM or calculator
     * @param {Object} telemetry - Current game state
     * @param {string} paradigm - Game mode: 'billiards' or 'minigolf'
     * @param {Object} context - Additional context (gameDriver, sessionLog, courseLayout)
     * @param {boolean} useLLM - Whether to use LLM (default true)
     * @returns {Promise<Object|null>} Shot decision or null
     */
    async decideShot(telemetry, paradigm, context = {}, useLLM = true) {
        if (useLLM) {
            // Hybrid: Calculator does math, LLM does reasoning
            return this.decideShotHybrid(telemetry, paradigm, context);
        } else {
            return this.decideShotWithCalculator(telemetry, paradigm);
        }
    }

    /**
     * Hybrid approach: LLM makes the full decision with full course context
     * Calculator provides baseline math, LLM decides personality adjustments
     * @private
     */
    async decideShotHybrid(telemetry, paradigm, context) {
        try {
            // Fetch and cache course layout on first shot
            if (!this.courseLayout && context.gameDriver) {
                this.courseLayout = await context.gameDriver.getCourseLayout() || {};
                console.log(`📍 Cached course layout: ${this.courseLayout.name || 'Unknown'}`);
            }
            
            // Get baseline shot from calculator for reference
            this._ensureCalculators();
            const calculator = this.calculators[paradigm];
            const baselineShot = calculator ? calculator.calculate(telemetry) : null;
            if (baselineShot) {
                console.log(`📐 Calculator baseline: angle=${baselineShot.angle?.toFixed(1)}°, power=${baselineShot.power?.toFixed(1)}`);
            }
            
            // Build prompt using appropriate version based on LLM service
            console.log('🧠 LLM deciding...');
            let decisionPrompt;
            
            if (this.isLocalLLM && this.promptBuilderV2) {
                // Use V2 builder for Ollama (includes power guidance)
                decisionPrompt = this.promptBuilderV2.buildPrompt(paradigm, {
                    gameState: telemetry,
                    courseLayout: this.courseLayout,
                    baselineShot: baselineShot,
                    sessionLog: context.sessionLog || []
                });
            } else {
                // Fallback to original builder for AOAI
                decisionPrompt = this._buildDecisionPrompt(telemetry, paradigm, context, baselineShot);
            }
            
            console.log(`📋 Prompt being sent:\n${decisionPrompt}\n---`);
            
            try {
                const llmResponse = await this.aoaiService.getShotDecision(decisionPrompt);
                if (llmResponse && llmResponse.angle !== undefined && llmResponse.power !== undefined) {
                    console.log(`🤖 LLM response: angle=${llmResponse.angle}°, power=${llmResponse.power}, commentary="${llmResponse.commentary}"`);
                    return llmResponse;
                } else if (!llmResponse) {
                    // LLM returned null (invalid JSON or parse failed) - fall back to calculator
                    console.log('⚠️  LLM returned invalid JSON, using calculator baseline instead');
                    return baselineShot;
                }
            } catch (e) {
                console.log('⚠️  LLM failed, falling back to calculator');
                return baselineShot;
            }
            
            return baselineShot;
        } catch (error) {
            console.error('❌ Hybrid decision error:', error.message);
            return null;
        }
    }

    /**
     * Build strict JSON-only prompt for LLM decision making (FALLBACK - original v1)
     * Used when promptBuilderV2 is not available
     * @private
     */
    _buildDecisionPrompt(telemetry, paradigmName, context, baselineShot) {
        const state = telemetry || {};
        const ball = state.ball || {};
        const emotion = this.personality?.getEmotionalState?.() || 'calm';
        const style = this.personality?.playStyle?.name || 'strategic';
        const confidence = Math.round((this.personality?.confidence || 0.5) * 100);
        const layout = this.courseLayout || {};
        
        let behaviorGuide = '';
        let gameContext = '';
        
        if (paradigmName === 'billiards') {
            switch (style) {
                case 'aggressive':
                    behaviorGuide = 'go for difficult shots, high power';
                    break;
                case 'chaotic':
                    behaviorGuide = 'ignore strategy, try crazy angles and power';
                    break;
                case 'cautious':
                    behaviorGuide = 'hit easiest target, safe power';
                    break;
                case 'perfectionist':
                    behaviorGuide = 'optimal target, optimal power';
                    break;
                default:
                    behaviorGuide = 'balanced target and power';
            }
            
            const targets = state.targetBallAnalysis || [];
            const easiestTarget = targets.length > 0 ? targets[0] : null;
            gameContext = `Sunk: ${state.sunkBalls?.length || 0} | Target balls available: ${targets.length}`;
            if (easiestTarget) {
                gameContext += ` | Easiest target dist: ${easiestTarget.distanceFromCue?.toFixed(1) || '?'}`;
            }
        } else {
            // Minigolf
            switch (style) {
                case 'aggressive':
                    behaviorGuide = '80-120 power, extreme angles';
                    break;
                case 'chaotic':
                    behaviorGuide = 'random power 0-120, any angle -180 to 180';
                    break;
                case 'cautious':
                    behaviorGuide = '20-50 power, safe angles';
                    break;
                case 'perfectionist':
                    behaviorGuide = 'optimal angle and power';
                    break;
                default:
                    behaviorGuide = '40-80 power, balanced angle';
            }
            
            gameContext = `Distance to hole: ${state.distanceToHole?.toFixed(1) || '?'} | Strokes: ${state.strokes || 0}`;
        }

        // Get shot history from context
        const shotHistory = (context.sessionLog || []).slice(-5)
            .map(log => `T${log.turn}:${log.state?.won ? '✓' : '✗'}`)
            .join(' ');

        // Build baseline suggestion with power adjustment guidance
        let baselineSuggestion = '';
        let powerGuidance = '';
        if (baselineShot) {
            baselineSuggestion = `\nBaseline: angle=${baselineShot.angle?.toFixed(1) || '?'}°, power=${baselineShot.power?.toFixed(1) || '?'}`;
            
            // Add style-specific power adjustment guidance
            if (paradigmName === 'billiards') {
                switch (style) {
                    case 'aggressive':
                        powerGuidance = `\nBilliards needs high power. Use 60-100+ to move balls across table.`;
                        break;
                    case 'chaotic':
                        powerGuidance = `\nGo wild with power: 20-120 anything goes.`;
                        break;
                    case 'cautious':
                        powerGuidance = `\nKeep power lower: 30-60 for safe shots.`;
                        break;
                    case 'perfectionist':
                        powerGuidance = `\nOptimize: use baseline power or adjust ±10.`;
                        break;
                    default:
                        powerGuidance = `\nBalanced power: 50-80 range.`;
                }
            } else {
                switch (style) {
                    case 'aggressive':
                        powerGuidance = `\nGo hard: 80-120 power for extreme shots.`;
                        break;
                    case 'chaotic':
                        powerGuidance = `\nRandom power: anywhere from 0-120.`;
                        break;
                    case 'cautious':
                        powerGuidance = `\nSafe power: 20-50 range.`;
                        break;
                    case 'perfectionist':
                        powerGuidance = `\nOptimal: adjust baseline ±5-10%.`;
                        break;
                    default:
                        powerGuidance = `\nBalanced: 40-80 power.`;
                }
            }
        }

        return `${paradigmName.toUpperCase()} DECISION - RETURN ONLY JSON, NO EXPLANATION
Ball: (${ball.x?.toFixed(1) || '?'}, ${ball.z?.toFixed(1) || '?'})
${paradigmName === 'minigolf' ? `Target: (${state.hole?.x?.toFixed(1) || '?'}, ${state.hole?.z?.toFixed(1) || '?'})` : `Available targets: ${state.targetBallAnalysis?.length || 0}`}
Course: ${layout.name || 'unknown'} (${layout.walls?.length || 0} walls, ${layout.obstacles?.length || 0} obstacles)
Game state: ${gameContext}
Recent: ${shotHistory || 'none'}

Personality: ${style}, feeling ${emotion} (${confidence}% confident)
Strategy: ${behaviorGuide}${baselineSuggestion}${powerGuidance}

POWER SCALE: 0=no power, 60=medium, 100+=maximum force
OUTPUT ONLY THIS JSON - NO TEXT BEFORE OR AFTER:
{"angle": NUMBER_HERE, "power": NUMBER_HERE, "commentary": "humorous one-liner max 15 words"}`;
    }

    /**
     * Build a simple prompt asking just for reasoning, not calculation
     * @private
     */

    /**
     * Decide shot using LLM (original method - can be disabled if hybrid works well)
     * @private
     */
    async decideShotWithLLM(telemetry, paradigm, context) {
        try {
            const { gameDriver, sessionLog, personalityContext } = context;
            
            // Get course layout if gameDriver provided
            const courseLayout = gameDriver 
                ? await gameDriver.getCourseLayout()
                : { name: 'Unknown', walls: [], obstacles: [] };
            
            // Build prompt
            const promptContext = {
                gameState: telemetry,
                courseLayout: courseLayout || { name: 'Unknown', walls: [], obstacles: [] },
                shotHistory: (sessionLog || []).slice(-5).map(log => ({
                    strategy: log.state?.won ? 'success' : 'attempt',
                    distanceChange: 0
                })),
                physicsObservations: [],
                personalityContext: personalityContext || {}
            };
            const prompt = this.promptBuilder.buildPrompt({ getModeName: () => paradigm }, promptContext);

            // Get shot decision from AOAI
            const shotDecision = await this.aoaiService.getShotDecision(prompt);
            
            if (shotDecision && shotDecision.angle !== undefined && shotDecision.power !== undefined) {
                console.log(`🎯 AI decision: angle=${shotDecision.angle.toFixed(1)}°, power=${shotDecision.power.toFixed(1)}`);
                
                // Adjust confidence based on paradigm-specific difficulty
                this.adjustConfidenceForLLMShot(telemetry, paradigm);
            }
            return shotDecision;

        } catch (error) {
            console.error('❌ LLM error:', error.message);
            return this.decideShotWithCalculator(telemetry, paradigm);
        }
    }

    /**
     * Decide shot using calculator
     * @private
     */
    decideShotWithCalculator(telemetry, paradigm) {
        console.log('🧮 Using shot calculator (no LLM)...');
        
        this._ensureCalculators();
        
        const calculator = this.calculators[paradigm];
        if (!calculator) {
            console.error(`❌ Unknown paradigm: ${paradigm}`);
            return null;
        }
        
        return calculator.calculate(telemetry);
    }

    /**
     * Adjust confidence based on LLM shot difficulty
     * @private
     */
    adjustConfidenceForLLMShot(telemetry, paradigm) {
        if (paradigm === 'billiards' && telemetry.targetBallAnalysis) {
            const analysis = telemetry.targetBallAnalysis || [];
            const easiestTarget = analysis.length > 0 ? analysis[0] : null;
            
            if (easiestTarget && easiestTarget.position) {
                const ball = telemetry.ball;
                const dx = easiestTarget.position.x - ball.x;
                const dz = easiestTarget.position.z - ball.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance < 3) {
                    this.personality.updateConfidence(0.15);
                } else if (distance < 8) {
                    this.personality.updateConfidence(0.05);
                } else {
                    this.personality.updateConfidence(-0.1);
                }
            }
        } else if (paradigm === 'minigolf' && telemetry.hole) {
            const distance = telemetry.distanceToHole || 999;
            
            if (distance < 1.5) {
                this.personality.updateConfidence(0.3);
            } else if (distance < 4) {
                this.personality.updateConfidence(0.15);
            } else if (distance < 8) {
                this.personality.updateConfidence(0.05);
            } else {
                this.personality.updateConfidence(-0.05);
            }
        }
    }
}

export default ShotDecisionService;
