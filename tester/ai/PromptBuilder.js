import { BilliardsPromptBuilder } from './BilliardsPromptBuilder.js';
import { MinigolfPromptBuilder } from './MinigolfPromptBuilder.js';

/**
 * Prompt Builder Factory - Delegates to paradigm-specific prompt builders
 */
export class PromptBuilder {
    constructor() {
        this.billiardsBuilder = new BilliardsPromptBuilder();
        this.minigolfBuilder = new MinigolfPromptBuilder();
    }

    /**
     * Build complete prompt for a given paradigm
     */
    buildPrompt(paradigm, context) {
        const paradigmName = paradigm.getModeName();
        const isSmallModel = process.env.OLLAMA_MODEL?.includes('phi') || false;
        
        if (isSmallModel) {
            return this.buildSimplifiedPrompt(paradigm, context);
        }
        
        if (paradigmName === 'billiards') {
            return this.billiardsBuilder.buildPrompt(context);
        } else if (paradigmName === 'minigolf') {
            return this.minigolfBuilder.buildPrompt(context);
        }
        
        return this.buildGenericPrompt(context);
    }

    /**
     * Simplified prompt for smaller models (Phi3, etc)
     */
    buildSimplifiedPrompt(paradigm, context) {
        const state = context.gameState || {};
        const paradigmName = paradigm.getModeName();
        
        if (paradigmName === 'minigolf') {
            const dx = (state.hole?.x || 0) - (state.ball?.x || 0);
            const dz = (state.hole?.z || 0) - (state.ball?.z || 0);
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            return `You are playing minigolf. The ball is at (${state.ball?.x.toFixed(1)}, ${state.ball?.z.toFixed(1)}) and the hole is at (${state.hole?.x.toFixed(1)}, ${state.hole?.z.toFixed(1)}).

Distance to hole: ${distance.toFixed(1)} units
Strokes so far: ${state.strokes || 0}

Decide your next shot. Return ONLY a JSON object like this (no comments, no extra text):
{"angle": 45, "power": 25, "reasoning": "Short explanation"}`;
        } else {
            return `You are playing billiards. Ball at (${state.ball?.x?.toFixed(1)}, ${state.ball?.z?.toFixed(1)}).

Decide your next shot. Return ONLY JSON: {"angle": -45, "power": 15, "reasoning": "Explanation"}`;
        }
    }



    /**
     * Build generic prompt (fallback)
     */
    buildGenericPrompt(context) {
        return `# GAME

## Current State:
${JSON.stringify(context.gameState, null, 2)}

## Your Task:
Decide the next shot.

Respond in JSON with: reasoning, angle, power.`;
    }
}
