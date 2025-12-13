/**
 * ShotCalculator - Base class for game-specific shot calculations
 * Defines interface that all game modes must implement
 */
export class ShotCalculator {
    constructor(personality) {
        this.personality = personality;
    }

    /**
     * Calculate shot decision
     * @param {Object} telemetry - Current game state
     * @returns {Object|null} { angle, power, reasoning }
     */
    calculate(telemetry) {
        throw new Error('calculate() must be implemented by subclass');
    }

    /**
     * Adjust personality confidence based on shot difficulty
     * @param {number} distance - Distance to target
     * @protected
     */
    adjustConfidence(distance) {
        // Override in subclass
    }
}

export default ShotCalculator;
