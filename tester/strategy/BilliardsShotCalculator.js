import { ShotCalculator } from './ShotCalculator.js';

/**
 * BilliardsShotCalculator - Billiards-specific shot calculation
 */
export class BilliardsShotCalculator extends ShotCalculator {
    calculate(telemetry) {
        const { ball, dynamicBalls, targetBallAnalysis } = telemetry;
        
        if (dynamicBalls.length === 0) {
            console.log('🎉 All balls sunk!');
            return null;
        }

        // Get easiest target from analysis
        const analysis = targetBallAnalysis || [];
        const easiestTarget = analysis.length > 0 ? analysis[0] : dynamicBalls[0];
        
        const targetBall = easiestTarget.position 
            ? { x: easiestTarget.position.x, z: easiestTarget.position.z }
            : { x: easiestTarget.x, z: easiestTarget.z };
        
        console.log(`🎱 Ball position: (${ball.x.toFixed(2)}, ${ball.z.toFixed(2)})`);
        console.log(`🎯 Target ball: (${targetBall.x.toFixed(2)}, ${targetBall.z.toFixed(2)})`);
        
        const dx = targetBall.x - ball.x;
        const dz = targetBall.z - ball.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx) * 180 / Math.PI;
        
        console.log(`📏 Delta: dx=${dx.toFixed(2)}, dz=${dz.toFixed(2)}, distance=${distance.toFixed(2)}`);
        console.log(`📐 Calculated angle: ${angle.toFixed(1)}° (atan2(${dz.toFixed(2)}, ${dx.toFixed(2)}))`);
        
        // Adjust confidence based on shot difficulty
        this.adjustConfidence(distance);
        
        // Billiards uses lower power (heavier physics)
        let power;
        if (distance < 3) {
            power = 5 + Math.random() * 3;
        } else if (distance < 8) {
            power = 8 + Math.random() * 7;
        } else {
            power = 15 + Math.random() * 10;
        }
        
        return { 
            angle, 
            power, 
            reasoning: `Aiming at ${easiestTarget.color || easiestTarget.id} ball` 
        };
    }

    adjustConfidence(distance) {
        if (distance < 3) {
            this.personality.updateConfidence(0.15);  // Close shots
        } else if (distance < 8) {
            this.personality.updateConfidence(0.05);  // Medium distance
        } else {
            this.personality.updateConfidence(-0.1);  // Far shots
        }
    }
}

export default BilliardsShotCalculator;
