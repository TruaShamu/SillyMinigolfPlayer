import { BilliardsPromptBuilderV2 } from './BilliardsPromptBuilderV2.js';
import { MinigolfPromptBuilderV2 } from './MinigolfPromptBuilderV2.js';

/**
 * Prompt Builder V2 - Optimized for Ollama/LocalLLM
 * Includes power guidance and baseline suggestions
 */
export class PromptBuilderV2 {
    constructor(personality) {
        this.personality = personality;
        this.billiardsBuilder = new BilliardsPromptBuilderV2(personality);
        this.minigolfBuilder = new MinigolfPromptBuilderV2(personality);
    }

    /**
     * Build paradigm-specific prompt with baseline
     * @param {string} paradigmName - 'billiards' or 'minigolf'
     * @param {Object} context - Game state, layout, baselineShot, sessionLog
     * @returns {string} Prompt for LLM
     */
    buildPrompt(paradigmName, context) {
        if (paradigmName === 'billiards') {
            return this.billiardsBuilder.buildPrompt(context);
        } else if (paradigmName === 'minigolf') {
            return this.minigolfBuilder.buildPrompt(context);
        }
        
        throw new Error(`Unknown paradigm: ${paradigmName}`);
    }
}

export default PromptBuilderV2;
