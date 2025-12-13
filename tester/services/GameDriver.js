import { chromium } from 'playwright';

/**
 * GameDriver - Encapsulates all Playwright/browser interactions
 * Handles page management, game state queries, and input execution
 */
export class GameDriver {
    constructor() {
        this.browser = null;
        this.page = null;
        this.context = null;
    }

    /**
     * Launch browser and load game
     * @param {string} gameUrl - Full URL to game including course parameter
     * @returns {Promise<void>}
     */
    async initialize(gameUrl) {
        console.log('🌐 Loading game...');
        
        this.browser = await chromium.launch({ headless: false });
        this.context = await this.browser.newContext({ 
            viewport: { width: 1280, height: 800 } 
        });
        this.page = await this.context.newPage();

        await this.page.goto(gameUrl, { waitUntil: 'networkidle' });
        await this.page.waitForTimeout(2000);

        // Wait for game to load
        await this.page.waitForFunction(() => window.gameState && window.gameState.courseLoaded, 
            { timeout: 10000 });

        console.log('✅ Game loaded successfully\n');
    }

    /**
     * Close browser and cleanup
     * @returns {Promise<void>}
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    /**
     * Get the browser instance (for cleanup handlers)
     * @returns {Object|null}
     */
    getBrowser() {
        return this.browser;
    }

    /**
     * Check if game is in billiards mode
     * @returns {Promise<boolean>}
     */
    async isBilliardsMode() {
        return await this.page.evaluate(() => window.gameState.isBilliardsMode());
    }

    /**
     * Get full game state
     * @returns {Promise<Object>}
     */
    async getGameState() {
        return await this.page.evaluate(() => window.gameState.getFullState());
    }

    /**
     * Get course layout
     * @returns {Promise<Object>}
     */
    async getCourseLayout() {
        return await this.page.evaluate(() => window.gameState.getCourseLayout());
    }

    /**
     * Check if ball is moving
     * @returns {Promise<boolean>}
     */
    async isBallMoving() {
        return await this.page.evaluate(() => window.gameState.isBallMoving());
    }

    /**
     * Wait for ball to stop moving
     * @param {number} maxWait - Maximum wait time in ms
     * @returns {Promise<boolean>} True if ball stopped, false if timeout
     */
    async waitForBallToStop(maxWait = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const isMoving = await this.isBallMoving();
            if (!isMoving) {
                return true;
            }
            await this.page.waitForTimeout(100);
        }
        
        console.log('⚠️  Ball still moving after timeout');
        return false;
    }

    /**
     * Take screenshot of current game state
     * @param {string} filePath - Path to save screenshot
     * @returns {Promise<void>}
     */
    async takeScreenshot(filePath) {
        await this.page.screenshot({ path: filePath });
    }

    /**
     * Execute a shot given angle and power
     * @param {Object} shotDecision - { angle, power }
     * @returns {Promise<void>}
     */
    async executeShot(shotDecision) {
        // Get ball position in world coordinates
        const ballWorld = await this.page.evaluate(() => {
            const ball = window.gameState.getBallPosition();
            return { x: ball.x, z: ball.z };
        });
        
        // Convert ball to screen coordinates
        const ballScreen = await this.page.evaluate(({ x, z }) => {
            const pos = window.gameState.worldToScreen(x, z);
            const canvas = document.getElementById('gameCanvas');
            const rect = canvas.getBoundingClientRect();
            return { x: pos.x + rect.left, y: pos.y + rect.top };
        }, ballWorld);
        
        // Calculate drag target in WORLD coordinates
        const angleRad = (shotDecision.angle * Math.PI) / 180;
        const worldDragDistance = shotDecision.power / 10; // Convert power to world units
        
        // Calculate target world position (opposite of shot direction)
        const targetWorldX = ballWorld.x - Math.cos(angleRad) * worldDragDistance;
        const targetWorldZ = ballWorld.z - Math.sin(angleRad) * worldDragDistance;
        
        // Convert target world position to screen coordinates
        const targetScreen = await this.page.evaluate(({ x, z }) => {
            const pos = window.gameState.worldToScreen(x, z);
            const canvas = document.getElementById('gameCanvas');
            const rect = canvas.getBoundingClientRect();
            return { x: pos.x + rect.left, y: pos.y + rect.top };
        }, { x: targetWorldX, z: targetWorldZ });
        
        // Execute drag
        await this.page.mouse.move(ballScreen.x, ballScreen.y);
        await this.page.mouse.down();
        await this.page.mouse.move(targetScreen.x, targetScreen.y, { steps: 10 });
        await this.page.mouse.up();
        
        // Wait for shot to process
        await this.page.waitForTimeout(300);
    }

    /**
     * Get current ball position
     * @returns {Promise<Object>} { x, z }
     */
    async getBallPosition() {
        return await this.page.evaluate(() => {
            const ball = window.gameState.getBallPosition();
            return { x: ball.x, z: ball.z };
        });
    }
}

export default GameDriver;
