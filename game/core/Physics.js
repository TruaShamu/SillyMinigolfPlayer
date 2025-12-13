/**
 * Universal physics calculations for all game modes
 */
export class Physics {
    /**
     * Calculate distance between two points
     * @param {Object} p1 - Point 1 with x, z properties
     * @param {Object} p2 - Point 2 with x, z properties
     * @returns {number} Distance
     */
    static distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dz = (p1.z || p1.y) - (p2.z || p2.y);
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Calculate velocity magnitude
     * @param {Object} vel - Velocity with x, z properties
     * @returns {number} Speed
     */
    static velocityMagnitude(vel) {
        if (!vel) return 0;
        const vz = vel.z !== undefined ? vel.z : vel.y;
        return Math.sqrt(vel.x ** 2 + vz ** 2);
    }

    /**
     * Apply friction to velocity
     * @param {Object} velocity - Current velocity
     * @param {number} frictionCoeff - Friction coefficient (e.g., 0.98)
     * @returns {Object} New velocity
     */
    static applyFriction(velocity, frictionCoeff) {
        return {
            x: velocity.x * frictionCoeff,
            z: velocity.z * frictionCoeff
        };
    }

    /**
     * Calculate angle between two points
     * @param {Object} from - Start point
     * @param {Object} to - End point
     * @returns {number} Angle in radians
     */
    static angleBetween(from, to) {
        const fromZ = from.z !== undefined ? from.z : from.y;
        const toZ = to.z !== undefined ? to.z : to.y;
        return Math.atan2(toZ - fromZ, to.x - from.x);
    }

    /**
     * Simulate ball trajectory (for AI planning)
     * @param {Object} start - Starting position
     * @param {Object} velocity - Initial velocity
     * @param {number} friction - Friction coefficient
     * @param {number} maxSteps - Max simulation steps
     * @returns {Array} Array of positions
     */
    static calculateTrajectory(start, velocity, friction, maxSteps = 1000) {
        const trajectory = [];
        let pos = { ...start };
        let vel = { ...velocity };
        const threshold = 0.01;

        for (let step = 0; step < maxSteps; step++) {
            trajectory.push({ ...pos });

            // Update position
            pos.x += vel.x;
            pos.z = (pos.z || pos.y || 0) + (vel.z || vel.y || 0);

            // Apply friction
            vel.x *= friction;
            vel.z = (vel.z || vel.y || 0) * friction;

            // Stop if velocity is too low
            if (Math.abs(vel.x) < threshold && Math.abs(vel.z || vel.y || 0) < threshold) {
                break;
            }
        }

        return trajectory;
    }

    /**
     * Check if a line intersects with walls
     * @param {Object} start - Start point
     * @param {Object} end - End point
     * @param {Array} walls - Array of wall objects
     * @returns {boolean} True if path is blocked
     */
    static checkWallCollision(start, end, walls) {
        if (!walls || walls.length === 0) return false;

        for (const wall of walls) {
            if (this.lineIntersectsLine(
                start.x, start.z || start.y,
                end.x, end.z || end.y,
                wall.x1, wall.z1,
                wall.x2, wall.z2
            )) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if two line segments intersect
     * @private
     */
    static lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (denom === 0) return false;

        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    /**
     * Estimate shot distance based on power and physics
     * @param {number} power - Shot power
     * @param {number} friction - Friction coefficient
     * @param {number} ratio - Power-to-distance ratio (paradigm-specific)
     * @returns {number} Estimated distance
     */
    static estimateShotDistance(power, friction, ratio = 10) {
        // Simple model: distance ≈ power * ratio
        // More accurate: simulate with friction
        return power * ratio;
    }

    /**
     * Calculate power needed for a desired distance
     * @param {number} distance - Desired distance
     * @param {number} friction - Friction coefficient
     * @param {number} ratio - Power-to-distance ratio
     * @returns {number} Required power
     */
    static powerForDistance(distance, friction, ratio = 10) {
        return distance / ratio;
    }

    /**
     * Normalize an angle to 0-2π range
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    static normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    }

    /**
     * Calculate distance from point to line segment
     * @param {number} px - Point x
     * @param {number} py - Point y
     * @param {number} x1 - Line start x
     * @param {number} y1 - Line start y
     * @param {number} x2 - Line end x
     * @param {number} y2 - Line end y
     * @returns {number} Distance
     */
    static pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let t = lenSq !== 0 ? dot / lenSq : -1;
        t = Math.max(0, Math.min(1, t));
        const nearX = x1 + t * C;
        const nearY = y1 + t * D;
        return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
    }

    /**
     * Swept collision: Does a line segment intersect a circle?
     * Used for fast-moving balls that might skip over holes
     * @param {Object} p1 - Start point of line segment
     * @param {Object} p2 - End point of line segment
     * @param {Object} circleCenter - Circle center
     * @param {number} radius - Circle radius
     * @returns {boolean} True if segment intersects circle
     */
    static lineCircleIntersection(p1, p2, circleCenter, radius) {
        // Distance from circle center to line segment
        const dist = Physics.pointToLineDistance(
            circleCenter.x, circleCenter.z,
            p1.x, p1.z,
            p2.x, p2.z
        );
        return dist < radius;
    }
}
