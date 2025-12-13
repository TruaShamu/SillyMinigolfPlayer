/**
 * AI Companion UI - Displays personality, emotion, and shot decisions
 * Shows a sidebar to the right of the game screen with live updates
 */
export class AICompanionUI {
    constructor() {
        this.overlay = document.getElementById('ai-overlay');
        this.statusDiv = document.getElementById('ai-status');
        this.lastDecision = null;
        this.currentPersonality = null;
        this.isVisible = false;
    }

    /**
     * Show the companion UI overlay
     */
    show() {
        if (this.overlay) {
            this.overlay.classList.add('visible');
            this.isVisible = true;
        }
    }

    /**
     * Hide the companion UI overlay
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            this.isVisible = false;
        }
    }

    /**
     * Update with personality and shot decision info
     * @param {Object} personalityState - { emotion, confidence, playStyle }
     * @param {Object} shotDecision - { angle, power, reasoning, commentary }
     */
    updateDecision(personalityState, shotDecision) {
        this.currentPersonality = personalityState;
        this.lastDecision = shotDecision;
        this.render();
    }

    /**
     * Render the UI
     * @private
     */
    render() {
        if (!this.statusDiv) return;

        const personality = this.currentPersonality || {};
        const decision = this.lastDecision || {};

        const emotionEmoji = {
            'calm': '😊',
            'confident': '😎',
            'frustrated': '😤',
            'nervous': '😰',
            'annoyed': '😠'
        };

        const styleIcon = {
            'aggressive': '⚡',
            'cautious': '🐢',
            'strategic': '🧠',
            'chaotic': '🎲',
            'perfectionist': '✨'
        };

        const emoji = emotionEmoji[personality.emotion] || '🤖';
        const icon = styleIcon[personality.playStyle] || '🎮';
        const confidence = Math.round((personality.confidence || 0.5) * 100);

        let html = `
<div style="border-bottom: 1px solid #0af; padding-bottom: 8px; margin-bottom: 8px;">
    <div style="font-size: 14px; font-weight: bold; color: #0f0; margin-bottom: 8px;">
        AI COMPANION
    </div>
    
    <div style="display: grid; gap: 6px; font-size: 10px;">
        <!-- Emotion -->
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">${emoji}</span>
            <span style="color: #aaa;">Emotion:</span>
            <span style="color: #0af; font-weight: bold;">${personality.emotion || 'unknown'}</span>
        </div>
        
        <!-- Style -->
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">${icon}</span>
            <span style="color: #aaa;">Style:</span>
            <span style="color: #0af; font-weight: bold;">${personality.playStyle || 'unknown'}</span>
        </div>
        
        <!-- Confidence Bar -->
        <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #aaa; min-width: 50px;">Confidence:</span>
            <div style="flex: 1; height: 12px; background: #333; border: 1px solid #0af; border-radius: 2px; overflow: hidden;">
                <div style="height: 100%; width: ${confidence}%; background: linear-gradient(90deg, #0af, #0f0); transition: width 0.3s;"></div>
            </div>
            <span style="color: #0f0; font-weight: bold; min-width: 25px; text-align: right;">${confidence}%</span>
        </div>
    </div>
</div>

<div style="border-bottom: 1px solid #0af; padding-bottom: 8px; margin-bottom: 8px;">
    <div style="font-size: 14px; font-weight: bold; color: #fa0; margin-bottom: 6px;">
        DECISION
    </div>
    
    <div style="display: grid; gap: 4px; font-size: 10px;">
        ${decision.angle !== undefined ? `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #aaa;">Angle:</span>
                <span style="color: #0f0; font-weight: bold; font-family: monospace;">${decision.angle.toFixed(1)}°</span>
            </div>
        ` : ''}
        
        ${decision.power !== undefined ? `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #aaa;">Power:</span>
                <span style="color: #0f0; font-weight: bold; font-family: monospace;">${decision.power.toFixed(1)}</span>
            </div>
        ` : ''}
        
        ${decision.commentary ? `
            <div style="color: #fa0; margin-top: 4px; padding: 4px; background: rgba(255, 170, 0, 0.1); border-left: 2px solid #fa0; border-radius: 2px;">
                "${decision.commentary}"
            </div>
        ` : ''}
    </div>
</div>

<div style="font-size: 9px; color: #666; padding-top: 4px;">
    <div>LLM: ${decision.timestamp ? new Date(decision.timestamp).toLocaleTimeString() : 'waiting...'}</div>
</div>
        `;

        this.statusDiv.innerHTML = html;
    }

    /**
     * Clear the display
     */
    clear() {
        if (this.statusDiv) {
            this.statusDiv.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Waiting for AI...</div>';
        }
        this.lastDecision = null;
    }
}

export default AICompanionUI;
