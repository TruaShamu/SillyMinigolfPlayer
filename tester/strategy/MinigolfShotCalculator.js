import { ShotCalculator } from './ShotCalculator.js';

/**
 * MinigolfShotCalculator - Minigolf-specific shot calculation
 */
export class MinigolfShotCalculator extends ShotCalculator {
    calculate(telemetry) {
        const ball = telemetry.ball;
        const hole = telemetry.hole;
        
        const dx = hole.x - ball.x;
        const dz = hole.z - ball.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx) * 180 / Math.PI;
        
        // Scale power by distance
        let power;
        if (distance < 2) {
            power = 15 + Math.random() * 8;  // Close: 15-23
        } else if (distance < 5) {
            power = 28 + Math.random() * 10;  // Medium: 28-38
        } else {
            power = 38 + Math.random() * 14;  // Far: 38-52
        }
        
        // Adjust confidence based on difficulty
        this.adjustConfidence(distance);
        
        return { 
            angle, 
            power, 
            reasoning: 'Direct shot to hole' 
        };
    }

    adjustConfidence(distance) {
        if (distance < 1.5) {
            this.personality.updateConfidence(0.3);   // Very close - high boost
        } else if (distance < 4) {
            this.personality.updateConfidence(0.15);  // Moderate distance
        } else if (distance < 8) {
            this.personality.updateConfidence(0.05);  // Far from hole
        } else {
            this.personality.updateConfidence(-0.05); // Very far - penalty
        }
    }
}

export default MinigolfShotCalculator;
