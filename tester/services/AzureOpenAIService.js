import { AzureOpenAI } from 'openai';

/**
 * AzureOpenAIService - Encapsulates all AOAI interactions
 * Handles client setup, API calls, and response parsing
 */
export class AzureOpenAIService {
    constructor(config = {}) {
        const {
            apiKey = process.env.AZURE_OPENAI_API_KEY,
            endpoint = process.env.AZURE_OPENAI_ENDPOINT,
            deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
            apiVersion = '2025-01-01-preview'
        } = config;

        // Validate required credentials
        if (!apiKey) {
            throw new Error('Azure OpenAI API key is required. Set AZURE_OPENAI_API_KEY environment variable.');
        }
        if (!endpoint) {
            throw new Error('Azure OpenAI endpoint is required. Set AZURE_OPENAI_ENDPOINT environment variable.');
        }

        this.client = new AzureOpenAI({
            apiKey,
            endpoint,
            apiVersion
        });
        
        this.deploymentName = deploymentName;
    }

    /**
     * Get shot decision from LLM
     * @param {string} prompt - The game prompt for the LLM
     * @returns {Promise<Object>} Shot decision { angle, power, reasoning }
     */
    async getShotDecision(prompt) {
        try {
            console.log('🤖 Consulting Azure OpenAI for shot decision...');
            
            const response = await this.client.chat.completions.create({
                model: this.deploymentName,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            });

            const aiResponse = response.choices[0].message.content;
            console.log('📝 AI Response:', aiResponse.substring(0, 200));
            return this.parseShotDecision(aiResponse);

        } catch (error) {
            console.error('❌ Azure OpenAI error:', error.message);
            throw error;
        }
    }

    /**
     * Parse LLM response into shot decision
     * @param {string} aiResponse - Raw response from LLM
     * @returns {Object|null} Shot decision or null if parse fails
     */
    parseShotDecision(aiResponse) {
        // Try JSON first (handle markdown code blocks)
        try {
            let cleanResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.angle !== undefined && parsed.power !== undefined) {
                    return this.clampShotDecision({
                        angle: parsed.angle,
                        power: parsed.power,
                        reasoning: parsed.reasoning || aiResponse
                    });
                }
            }
        } catch (e) {
            console.log(`⚠️  JSON parse error: ${e.message}`);
        }

        // Extract angle and power from text patterns
        const angleMatch = aiResponse.match(/angle[:\s]*(-?\d+\.?\d*)/i);
        const powerMatch = aiResponse.match(/power[:\s]*(\d+\.?\d*)/i);

        if (!angleMatch || !powerMatch) {
            console.log(`⚠️  Could not parse AI response. Response preview: ${aiResponse.substring(0, 100)}`);
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
     * Clamp shot values to safe ranges
     * @private
     */
    clampShotDecision(decision) {
        return {
            angle: Math.max(-180, Math.min(180, decision.angle)),
            power: Math.max(1, Math.min(60, decision.power)),
            reasoning: decision.reasoning
        };
    }
}

export default AzureOpenAIService;
