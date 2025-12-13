import { GameParadigm } from './GameParadigm.js';

/**
 * Billiards game paradigm
 * Goal: Sink all target balls into pockets without sinking the cue ball
 */
export class BilliardsParadigm extends GameParadigm {
    getObjective() {
        return 'sink_target_balls';
    }

    isWinCondition(state) {
        // Win when all target balls are sunk
        return state.dynamicBalls && state.dynamicBalls.length === 0 && 
               state.sunkBalls && state.sunkBalls.length > 0;
    }

    isLoseCondition(state) {
        // Lose when time runs out or cue ball is sunk
        return (state.timeRemaining <= 0 && !this.isWinCondition(state)) ||
               state.cueBallSunk === true;
    }

    shouldSinkCueBall() {
        // In billiards, the cue ball should NOT sink
        return false;
    }

    getWinMessage(state) {
        const sunkCount = state.sunkBalls ? state.sunkBalls.length : 0;
        return `All ${sunkCount} balls sunk in ${state.strokes} shots! 🎱`;
    }

    getLoseMessage(state) {
        if (state.cueBallSunk) {
            return 'Cue ball sunk - Game over! ❌';
        }
        return 'Time\'s up! ⏰';
    }

    getModeName() {
        return 'billiards';
    }

    getDescription() {
        return 'Billiards: Hit target balls into pockets. Avoid sinking the cue ball.';
    }

    getFriction() {
        // Billiards tables have different friction than minigolf
        return 0.98;
    }

    getRelevantMetrics(state) {
        return {
            targetBallsRemaining: state.dynamicBalls ? state.dynamicBalls.length : 0,
            ballsSunk: state.sunkBalls ? state.sunkBalls.length : 0,
            strokes: state.strokes,
            timeRemaining: state.timeRemaining,
            pockets: state.pockets || []
        };
    }

    analyzeGameState(state) {
        const remaining = state.dynamicBalls ? state.dynamicBalls.length : 0;
        const sunk = state.sunkBalls ? state.sunkBalls.length : 0;
        
        return {
            ballsRemaining: remaining,
            ballsSunk: sunk,
            progress: sunk / (sunk + remaining),
            nearEnd: remaining <= 1,
            justStarted: sunk === 0
        };
    }
}
