/**
 * Base class for game paradigms (minigolf, billiards, etc.)
 * Defines the interface that all game modes must implement
 */
export class GameParadigm {
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * Get the objective of this game mode
     * @returns {string} Objective description
     */
    getObjective() {
        throw new Error('getObjective() must be implemented by subclass');
    }

    /**
     * Check if the player has won
     * @param {Object} state - Current game state
     * @returns {boolean}
     */
    isWinCondition(state) {
        throw new Error('isWinCondition() must be implemented by subclass');
    }

    /**
     * Check if the player has lost
     * @param {Object} state - Current game state
     * @returns {boolean}
     */
    isLoseCondition(state) {
        throw new Error('isLoseCondition() must be implemented by subclass');
    }

    /**
     * Should the cue ball sink into holes/pockets?
     * @returns {boolean} true if cue ball can sink, false otherwise
     */
    shouldSinkCueBall() {
        throw new Error('shouldSinkCueBall() must be implemented by subclass');
    }

    /**
     * Get victory message
     * @param {Object} state - Final game state
     * @returns {string}
     */
    getWinMessage(state) {
        return 'You won!';
    }

    /**
     * Get defeat message
     * @param {Object} state - Final game state
     * @returns {string}
     */
    getLoseMessage(state) {
        return 'Game over!';
    }

    /**
     * Get friction coefficient for this game mode
     * @returns {number}
     */
    getFriction() {
        return 0.98;
    }

    /**
     * Get max power for shots
     * @returns {number}
     */
    getMaxPower() {
        return 30;
    }

    /**
     * Get ball radius
     * @returns {number}
     */
    getBallRadius() {
        return 0.3;
    }

    /**
     * Get game mode name
     * @returns {string}
     */
    getModeName() {
        throw new Error('getModeName() must be implemented by subclass');
    }

    /**
     * Get game description
     * @returns {string}
     */
    getDescription() {
        throw new Error('getDescription() must be implemented by subclass');
    }

    /**
     * Get relevant metrics for this game mode
     * @param {Object} state - Current game state
     * @returns {Object} Metrics object
     */
    getRelevantMetrics(state) {
        return {};
    }

    /**
     * Analyze game state for this paradigm
     * @param {Object} state - Current game state
     * @returns {Object} Analysis data
     */
    analyzeGameState(state) {
        return {};
    }

    /**
     * Get AI prompt context specific to this game mode
     * @returns {string}
     */
    getAIPromptContext() {
        return '';
    }

    /**
     * Get AI heuristics for shot decisions
     * @returns {Object}
     */
    getAIHeuristics() {
        return {};
    }
}
