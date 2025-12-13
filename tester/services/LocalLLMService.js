/**
 * LocalLLMService - Encapsulates Ollama interactions
 * Handles local LLM calls via Ollama API
 */
export class LocalLLMService {
    constructor(config = {}) {
        const {
            modelName = process.env.OLLAMA_MODEL || 'phi3:latest',
            endpoint = process.env.OLLAMA_ENDPOINT || 'http://127.0.0.1:11434'
        } = config;

        this.modelName = modelName;
        this.endpoint = endpoint;
    }

    /**
     * Get shot decision from local LLM
     * @param {string} prompt - The game prompt for the LLM
     * @returns {Promise<Object>} Shot decision { angle, power, reasoning }
     */
    async getShotDecision(prompt) {
        try {
            console.log(`🤖 Consulting local LLM (${this.modelName}) for shot decision...`);
            
            const response = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false,
                    temperature: 0.5,
                    num_predict: 50
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            const inferenceMs = data.eval_duration ? Math.round(data.eval_duration / 1_000_000) : 'unknown';
            console.log(`⏱️  Inference time: ${inferenceMs}ms | Tokens: ${data.eval_count || '?'}`);
            console.log('📝 LLM Response:', data.response.substring(0, 200));
            return this.parseShotDecision(data.response);

        } catch (error) {
            console.error('❌ Local LLM error:', error.message);
            console.error('💡 Troubleshooting:');
            console.error(`   1. Test Ollama: curl http://127.0.0.1:11434/api/tags`);
            console.error('   2. Check Windows Firewall allows Node.js');
            console.error('   3. Verify Ollama desktop app is running');
            throw error;
        }
    }

    /**
     * Parse LLM response into shot decision
     * @param {string} aiResponse - Raw response from LLM
     * @returns {Object|null} Shot decision or null if parse fails
     */
    parseShotDecision(aiResponse) {
        // Try JSON first (handle markdown code blocks and text prefixes)
        try {
            let cleanResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            // Remove prefixes like "A) " or "B) " that models add
            cleanResponse = cleanResponse.replace(/^[A-Z]\)\s*/m, '');
            // Remove comments from JSON (Phi3 likes to add explanations)
            cleanResponse = cleanResponse.replace(/,\s*"[^"]*":\s*\{[^}]*"steps"[^}]*\}/gs, '');
            cleanResponse = cleanResponse.replace(/,\s*"steps":\s*\[[^\]]*\]/gs, '');
            
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                // Allow responses with just reasoning (no angle/power = keep baseline)
                if (parsed.reasoning || (parsed.angle !== undefined && parsed.power !== undefined)) {
                    // Ensure numeric values
                    let angle = parsed.angle;
                    let power = parsed.power;
                    
                    // Extract numbers from strings like "approximately 157.6°"
                    if (typeof angle === 'string') {
                        const angleNum = angle.match(/(-?\d+\.?\d*)/);
                        angle = angleNum ? parseFloat(angleNum[1]) : NaN;
                    }
                    if (typeof power === 'string') {
                        const powerNum = power.match(/(\d+\.?\d*)/);
                        power = powerNum ? parseFloat(powerNum[1]) : NaN;
                    }
                    
                    // If only reasoning (no angle/power), return null to signal "keep baseline"
                    if (angle === undefined && power === undefined) {
                        return null;
                    }
                    
                    return this.clampShotDecision({
                        angle: angle,
                        power: power,
                        reasoning: parsed.reasoning || parsed.reason || parsed.commentary || aiResponse,
                        commentary: parsed.commentary
                    });
                }
            }
        } catch (e) {
            // JSON parsing failed, fall back to text patterns
        }

        // Extract angle and power from text patterns (fallback)
        const angleMatch = aiResponse.match(/angle[:\s]*(?:approximately\s+)?(-?\d+\.?\d*)/i);
        const powerMatch = aiResponse.match(/power[:\s]*(?:approximately\s+)?(\d+\.?\d*)/i);

        if (!angleMatch || !powerMatch) {
            console.log(`⚠️  Could not parse LLM response. Response preview: ${aiResponse.substring(0, 100)}`);
            return null;
        }

        const angle = parseFloat(angleMatch[1]);
        const power = parseFloat(powerMatch[1]);

        return this.clampShotDecision({
            angle,
            power,
            reasoning: aiResponse
        });
    }

    /**
     * Generate plain text from prompt (for report generation, commentary, etc.)
     * Simpler than shot decision, just returns raw text
     * @param {string} prompt - The prompt for text generation
     * @returns {Promise<string>} Generated text
     */
    async generate(prompt) {
        try {
            const response = await fetch(`${this.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false,
                    temperature: 0.8,
                    num_predict: 100
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response.trim();

        } catch (error) {
            console.warn('⚠️  Text generation failed:', error.message);
            return '';
        }
    }

    /**
     * Synchronous fallback wrapper for generate (polls for completion)
     * @param {string} prompt - The prompt for text generation
     * @returns {string} Generated text or empty string if failed
     */
    generateSync(prompt) {
        // Since Node.js doesn't have blocking async, we return a promise
        // The calling code should use await, but this provides a fallback
        try {
            // For now, we'll just return empty and let async handle it
            // This is a compatibility method
            return '';
        } catch (e) {
            return '';
        }
    }

    /**
     * Clamp shot values to safe ranges
     * @private
     */
    clampShotDecision(decision) {
        return {
            angle: Math.max(-180, Math.min(180, decision.angle)),
            power: Math.max(0, Math.min(120, decision.power)),
            reasoning: decision.reasoning || decision.reason || "shot",
            commentary: decision.commentary
        };
    }
}

export default LocalLLMService;
