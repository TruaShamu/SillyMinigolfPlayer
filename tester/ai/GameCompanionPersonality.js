/**
 * Game Companion Personality System
 * Each companion has unique emotions, confidence, and play styles
 */
export class GameCompanionPersonality {
    constructor(preferredStyle = null) {
        this.frustrationLevel = 0;
        this.confidence = 0.5;
        this.playStyle = preferredStyle ? this.getStyleByName(preferredStyle) : this.randomPlayStyle();
        this.consecutiveFailures = 0;
        this.lastDistances = [];
    }

    randomPlayStyle() {
        const styles = [
            { name: 'cautious', description: 'Plays it safe, low power shots', powerMod: 0.7 },
            { name: 'aggressive', description: 'Goes for risky high-power shots', powerMod: 1.3 },
            { name: 'strategic', description: 'Thinks ahead, positions carefully', powerMod: 1.0 },
            { name: 'chaotic', description: 'Unpredictable, tries wild angles', powerMod: 1.2 },
            { name: 'perfectionist', description: 'Aims for optimal shots always', powerMod: 1.0 }
        ];
        return styles[Math.floor(Math.random() * styles.length)];
    }

    getStyleByName(name) {
        const styles = {
            'cautious': { name: 'cautious', description: 'Plays it safe, low power shots', powerMod: 0.7 },
            'aggressive': { name: 'aggressive', description: 'Goes for risky high-power shots', powerMod: 1.3 },
            'strategic': { name: 'strategic', description: 'Thinks ahead, positions carefully', powerMod: 1.0 },
            'chaotic': { name: 'chaotic', description: 'Unpredictable, tries wild angles', powerMod: 1.2 },
            'perfectionist': { name: 'perfectionist', description: 'Aims for optimal shots always', powerMod: 1.0 }
        };
        return styles[name.toLowerCase()] || this.randomPlayStyle();
    }

    /**
     * Update emotional state based on game progress
     */
    updateEmotion(turnData) {
        const { distanceChange, ballsSunk, strokes, didHitTarget, gameMode } = turnData;

        // Track distance history
        this.lastDistances.push(distanceChange || 0);
        if (this.lastDistances.length > 5) this.lastDistances.shift();

        // Update frustration and confidence based on success
        if (ballsSunk > 0) {
            // Ball sunk = great success!
            this.frustrationLevel = Math.max(0, this.frustrationLevel - 0.3);
            this.consecutiveFailures = 0;
            this.confidence = Math.min(1, this.confidence + 0.3);
        } else if (didHitTarget && distanceChange && distanceChange < 0) {
            // Shot improved position (moved closer to target)
            this.frustrationLevel = Math.max(0, this.frustrationLevel - 0.1);
            this.consecutiveFailures = 0;
            this.confidence = Math.min(1, this.confidence + 0.1); // Good shot boost
        } else if (distanceChange && distanceChange > 1) {
            // Shot made things noticeably worse (moved far from target)
            this.frustrationLevel = Math.min(1, this.frustrationLevel + 0.15);
            this.consecutiveFailures++;
            this.confidence = Math.max(0, this.confidence - 0.15); // Harder penalty for bad shots
        }
        // else: neutral/small change shot - don't penalize confidence

        // Check for patterns (stuck in a loop?)
        const avgDistance = this.lastDistances.reduce((a, b) => a + b, 0) / this.lastDistances.length;
        if (Math.abs(avgDistance) < 0.5 && this.lastDistances.length >= 5) {
            this.frustrationLevel = Math.min(1, this.frustrationLevel + 0.2);
        }

        // Random mood shifts (humans aren't perfectly rational)
        if (Math.random() < 0.1) {
            this.frustrationLevel += (Math.random() - 0.5) * 0.2;
            this.frustrationLevel = Math.max(0, Math.min(1, this.frustrationLevel));
        }
    }

    /**
     * Update confidence directly
     */
    updateConfidence(delta) {
        this.confidence = Math.max(0, Math.min(1, this.confidence + delta));
    }

    /**
     * Get current emotional state
     */
    getEmotionalState() {
        if (this.frustrationLevel > 0.7) return 'frustrated';
        if (this.frustrationLevel > 0.4) return 'annoyed';
        if (this.confidence > 0.7) return 'confident';
        if (this.confidence < 0.3) return 'nervous';
        return 'calm';
    }

    /**
     * Modify shot based on personality and emotion
     */
    modifyShot(baseShot, context) {
        const { angle, power, reasoning } = baseShot;
        const emotion = this.getEmotionalState();
        
        let modifiedAngle = angle;
        let modifiedPower = power * this.playStyle.powerMod;
        let modifiedReasoning = reasoning;

        // Emotional modifiers
        switch (emotion) {
            case 'frustrated':
                // Try something wild
                if (Math.random() < 0.3) {
                    modifiedAngle += (Math.random() - 0.5) * 60; // ±30° variation
                    modifiedPower *= 1.4;
                    modifiedReasoning = `[FRUSTRATED] Trying a wild shot - ${reasoning}`;
                    console.log('😤 Frustration level high - attempting aggressive variation!');
                }
                break;

            case 'annoyed':
                // Slight randomness
                modifiedAngle += (Math.random() - 0.5) * 20;
                modifiedPower *= 0.9 + Math.random() * 0.3;
                break;

            case 'confident':
                // Go for optimal but risky
                modifiedPower *= 1.1;
                modifiedReasoning = `[CONFIDENT] ${reasoning}`;
                break;

            case 'nervous':
                // Play it safe
                modifiedPower *= 0.8;
                modifiedAngle += (Math.random() - 0.5) * 10; // Small uncertainty
                modifiedReasoning = `[NERVOUS] Playing carefully - ${reasoning}`;
                break;
        }

        // Play style modifiers
        switch (this.playStyle.name) {
            case 'chaotic':
                // Random experimentation
                if (Math.random() < 0.15) {
                    modifiedAngle = Math.random() * 360 - 180;
                    modifiedReasoning = `[CHAOS MODE] Let's try something completely different!`;
                    console.log('🎲 Chaos mode activated!');
                }
                break;

            case 'aggressive':
                // Always go harder
                modifiedPower *= 1.2;
                break;

            case 'cautious':
                // Reduce power, stay safe
                modifiedPower *= 0.75;
                break;
        }

        // Clamp values
        modifiedAngle = ((modifiedAngle + 180) % 360) - 180; // Keep in -180 to 180
        modifiedPower = Math.max(0, Math.min(120, modifiedPower)); // Match LLM range 0-120

        return {
            angle: modifiedAngle,
            power: modifiedPower,
            reasoning: modifiedReasoning,
            emotion,
            playStyle: this.playStyle.name
        };
    }

    /**
     * Get prompt additions for LLM
     */
    getPromptAdditions() {
        const emotion = this.getEmotionalState();
        const frustrationText = this.frustrationLevel > 0.5 
            ? `\n⚠️ FRUSTRATION LEVEL: ${(this.frustrationLevel * 100).toFixed(0)}% - Consider trying a different approach!`
            : '';
        
        // Build power adjustment guidance based on style
        let powerGuidance = `Base power according to distance`;
        switch (this.playStyle.name) {
            case 'aggressive':
                powerGuidance = `Increase power by 20-30% above baseline - go for aggressive shots!`;
                break;
            case 'cautious':
                powerGuidance = `Reduce power by 20-25% - play conservatively and safely`;
                break;
            case 'chaotic':
                powerGuidance = `Vary power unpredictably - try unconventional power levels`;
                break;
            case 'confident':
                powerGuidance = `Increase power by 10% - play with moderate boldness`;
                break;
        }
        
        // Emotion-based angle and power adjustments
        let emotionGuidance = ``;
        switch (emotion) {
            case 'frustrated':
                emotionGuidance = `Your frustration is high! Consider wild angle variations (±20-30°) and boosted power (x1.3-1.5). Try something unexpected!`;
                break;
            case 'annoyed':
                emotionGuidance = `You're annoyed. Add slight angle variation (±10-15°) and reduce power slightly (x0.9).`;
                break;
            case 'confident':
                emotionGuidance = `You're confident! Increase power by 10% and consider risky angles.`;
                break;
            case 'nervous':
                emotionGuidance = `You're nervous. Reduce power by 20% and keep angles safe with small uncertainty (±5°).`;
                break;
            case 'calm':
                emotionGuidance = `You're calm and focused. Execute optimal shots as calculated.`;
                break;
        }
        
        return `
## YOUR PERSONALITY & PLAYING STYLE:
- Play Style: ${this.playStyle.name} (${this.playStyle.description})
- Emotional State: ${emotion}
- Confidence Level: ${(this.confidence * 100).toFixed(0)}% (0=nervous, 100=very confident)
- Recent Performance: ${this.consecutiveFailures} consecutive failures${frustrationText}

## HOW THIS AFFECTS YOUR SHOT DECISIONS:
1. **Power Adjustment**: ${powerGuidance}
2. **Emotional Impact**: ${emotionGuidance}
3. **Confidence Factor**: At ${(this.confidence * 100).toFixed(0)}% confidence, ${
    this.confidence < 0.3 ? 'play conservatively' : 
    this.confidence > 0.7 ? 'take calculated risks' : 
    'balance caution with aggression'
}

IMPORTANT: Apply these personality modifiers to your angle and power recommendations above!
`;
    }

    /**
     * Get status summary
     */
    getStatus() {
        return {
            emotion: this.getEmotionalState(),
            frustration: this.frustrationLevel,
            confidence: this.confidence,
            playStyle: this.playStyle.name,
            consecutiveFailures: this.consecutiveFailures
        };
    }
}
