import { GameParadigm } from './GameParadigm.js';

/**
 * Minigolf game paradigm
 * Goal: Get the ball into the hole in as few strokes as possible
 */
export class MinigolfParadigm extends GameParadigm {
    getObjective() {
        return 'reach_hole';
    }

    isWinCondition(state) {
        // Win when ball is in the hole
        return state.won === true;
    }

    isLoseCondition(state) {
        // No loss condition - only win by reaching the hole
        return false;
    }

    shouldSinkCueBall() {
        // In minigolf, the ball should sink into the hole
        return true;
    }

    getWinMessage(state) {
        return `Hole in ${state.strokes}! 🎯`;
    }

    getLoseMessage(state) {
        return 'Game ended (no loss condition). 🏌️';
    }

    getModeName() {
        return 'minigolf';
    }

    getDescription() {
        return 'Mini-Golf: Get the ball into the hole in as few strokes as possible.';
    }

    getRelevantMetrics(state) {
        return {
            distanceToHole: state.distanceToHole,
            strokes: state.strokes,
            timeRemaining: state.timeRemaining
        };
    }

    analyzeGameState(state) {
        const distToHole = state.distanceToHole || 0;
        return {
            closeToHole: distToHole < 2,
            veryClose: distToHole < 0.5,
            difficulty: distToHole > 10 ? 'hard' : distToHole > 5 ? 'medium' : 'easy'
        };
    }
}
