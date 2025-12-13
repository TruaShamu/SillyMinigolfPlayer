import fs from 'fs';
import path from 'path';

// Import AI modules
import { PromptBuilder } from './ai/PromptBuilder.js';
import { GameCompanionPersonality } from './ai/GameCompanionPersonality.js';

// Import services - choose one:
// import { AzureOpenAIService } from './services/AzureOpenAIService.js';
import { LocalLLMService } from './services/LocalLLMService.js';
import { GameDriver } from './services/GameDriver.js';
import { ShotDecisionService } from './services/ShotDecisionService.js';

// Import pipeline modules
import { ReportGenerator } from './pipeline/reportGenerator.js';

// Configuration
const USE_LLM_FOR_SHOTS = true;
const BASE_GAME_URL = 'http://localhost:3000/index.html';

// Get course from command line
const courseArg = process.argv[2] || 'l-shape';
const styleArg = process.argv[3] || null; // Optional: cautious, aggressive, strategic, chaotic, perfectionist
const GAME_URL = `${BASE_GAME_URL}?course=${courseArg}`;

// Session state
let sessionLog = [];
let sessionStartTime = null;
let finalState = null;
let outcome = 'Interrupted';

// Initialize services and modules
const llmService = new LocalLLMService(); // Using local Ollama
const gameDriver = new GameDriver();
const promptBuilder = new PromptBuilder();
const shotDecisionService = new ShotDecisionService(llmService, null, promptBuilder); // personality set after init
const reportGenerator = new ReportGenerator(path.join(process.cwd(), 'reports'));
const personality = new GameCompanionPersonality(styleArg);

// Set personality in shot decision service after initialization
shotDecisionService.personality = personality;

console.log(`🎮 Let's play! Companion starting on: ${courseArg}`);
console.log(`🌐 Game URL: ${GAME_URL}`);
console.log(`🤖 LLM: ${USE_LLM_FOR_SHOTS ? 'Enabled' : 'Disabled (Calculator only)'}`);
console.log(` Play Style: ${personality.playStyle.name}\n`);

// Cleanup handler
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Interrupted by user. Generating report...');
    outcome = 'Interrupted';
    
    // Capture final state from game if available
    if (gameDriver && gameDriver.getBrowser()) {
        try {
            finalState = await gameDriver.getGameState();
        } catch (e) {
            console.log('⚠️  Could not capture final state:', e.message);
        }
    }
    
    await generateFinalReport();
    await gameDriver.cleanup();
    process.exit(0);
});

async function main() {
    sessionStartTime = Date.now();

    try {
        // Initialize game driver
        await gameDriver.initialize(GAME_URL);

        // Get game mode from game state
        const isBilliardsMode = await gameDriver.isBilliardsMode();
        const paradigm = isBilliardsMode ? 'billiards' : 'minigolf';
        
        console.log(`🎯 Game Mode: ${paradigm.toUpperCase()}\n`);

        // Main game loop
        let turnCount = 0;
        const MAX_TURNS = isBilliardsMode ? 50 : 30;

        while (turnCount < MAX_TURNS) {
            turnCount++;
            
            // Check if game over
            const gameState = await gameDriver.getGameState();
            
            if (gameState.gameOver) {
                console.log(`\n🏁 Game Over! ${gameState.won ? '✅ WON' : '❌ LOST'}`);
                outcome = gameState.won ? 'Won' : 'Lost';
                finalState = gameState;
                break;
            }

            // Wait for ball to stop moving
            console.log(`\n--- Turn ${turnCount} ---`);
            const personalityStatus = personality.getStatus();
            console.log(`😊 Emotion: ${personalityStatus.emotion} | Style: ${personalityStatus.playStyle} | Confidence: ${(personalityStatus.confidence * 100).toFixed(0)}%`);
            await gameDriver.waitForBallToStop();

            // Get current game state
            const telemetry = await gameDriver.getGameState();
            
            // Take screenshot
            const screenshotPath = path.join(process.cwd(), `screenshots/turn_${turnCount}.png`);
            await gameDriver.takeScreenshot(screenshotPath);

            // Log turn state
            sessionLog.push({
                turn: turnCount,
                timestamp: Date.now() - sessionStartTime,
                state: telemetry,
                screenshot: screenshotPath
            });

            // Decide next shot
            let baseShotDecision;
            if (USE_LLM_FOR_SHOTS) {
                baseShotDecision = await shotDecisionService.decideShot(telemetry, paradigm, {
                    gameDriver,
                    sessionLog,
                    personalityContext: personality.getPromptAdditions()
                }, true);
            } else {
                baseShotDecision = shotDecisionService.decideShot(telemetry, paradigm, {}, false);
            }

            if (!baseShotDecision) {
                console.log('⚠️  Failed to decide shot. Game over.');
                outcome = 'Error';
                break;
            }

            // Apply personality modifications
            const shotDecision = personality.modifyShot(baseShotDecision, { telemetry, turnCount });
            console.log(`📏 Shot: angle=${shotDecision.angle.toFixed(1)}°, power=${shotDecision.power.toFixed(1)} [${shotDecision.emotion}]`);
            if (shotDecision.reasoning !== baseShotDecision.reasoning) {
                console.log(`💭 ${shotDecision.reasoning}`);
            }

            // Update companion UI with personality and decision
            await gameDriver.page.evaluate(({ personalityState, decision }) => {
                if (window.gameState && window.gameState.updateCompanionUI) {
                    window.gameState.updateCompanionUI(personalityState, decision);
                }
            }, {
                personalityState: personality.getStatus(),
                decision: {
                    angle: shotDecision.angle,
                    power: shotDecision.power,
                    commentary: shotDecision.commentary || shotDecision.reasoning,
                    emotion: shotDecision.emotion
                }
            });

            // Execute shot
            await gameDriver.executeShot(shotDecision);

            // Wait for ball to settle and get outcome
            await gameDriver.page.waitForTimeout(700);
            const afterState = await gameDriver.getGameState();
            
            // Update personality based on outcome
            const ballsSunkThisTurn = (afterState.sunkBalls?.length || 0) - (telemetry.sunkBalls?.length || 0);
            
            // Check if shot improved position (not just checking balls sunk)
            let didImprovePosition = ballsSunkThisTurn > 0;
            if (!didImprovePosition && telemetry.targetBallAnalysis && afterState.targetBallAnalysis) {
                const beforeClosest = telemetry.targetBallAnalysis[0]?.distanceFromCue || 999;
                const afterClosest = afterState.targetBallAnalysis[0]?.distanceFromCue || 999;
                didImprovePosition = afterClosest < beforeClosest;
            }
            
            personality.updateEmotion({
                distanceChange: 0,
                ballsSunk: ballsSunkThisTurn,
                strokes: turnCount,
                didHitTarget: didImprovePosition
            });

            await gameDriver.page.waitForTimeout(200);
        }

        if (turnCount >= MAX_TURNS) {
            console.log(`\n⏱️  Reached maximum turns (${MAX_TURNS})`);
            outcome = 'Timeout';
            finalState = await gameDriver.getGameState();
        }

        // Generate report
        await generateFinalReport();

    } catch (error) {
        console.error('\n❌ Error during game:', error);
        outcome = 'Error';
        await generateFinalReport();
    } finally {
        await gameDriver.cleanup();
    }
}

async function parseAIResponse(aiResponse, telemetry) {
    // This function is now in AzureOpenAIService, but keeping for backwards compatibility
    // The actual parsing happens in aoaiService.parseShotDecision()
    return aoaiService.parseShotDecision(aiResponse);
}

async function executeShot(shotDecision) {
    await gameDriver.executeShot(shotDecision);
}

async function generateFinalReport() {
    console.log('\n📊 Generating final report...');
    
    const sessionDuration = Date.now() - sessionStartTime;
    
    const report = {
        sessionData: {
            startTime: sessionStartTime,
            course: courseArg
        },
        sessionDuration,
        outcome,
        courseLayout: gameDriver.level ? {
            name: gameDriver.level.name || courseArg,
            description: gameDriver.level.description || '',
            walls: gameDriver.level.walls || [],
            obstacles: gameDriver.level.obstacles || [],
            holes: gameDriver.level.holes || [],
            regions: gameDriver.level.regions || []
        } : { name: courseArg },
        finalState,
        shotHistory: sessionLog || []
    };

    // Generate report files
    const reportPath = await reportGenerator.generate(report);
    console.log(`✅ Report saved to: ${reportPath}`);
    
    // Save quick summary
    const summaryPath = path.join(process.cwd(), 'game_session_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        course: courseArg,
        outcome,
        turns: sessionLog.length,
        timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`✅ Summary saved to: ${summaryPath}`);
}

// Run game session
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
