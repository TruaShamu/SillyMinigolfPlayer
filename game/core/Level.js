/**
 * Level class - unified representation of game courses
 */
export class Level {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.difficulty = data.difficulty || 'Unknown';
        this.description = data.description || '';
        
        // Determine paradigm
        this.paradigm = data.paradigm || this.detectParadigm(data);
        
        // Geometry
        this.bounds = data.bounds || { minX: -7, maxX: 7, minZ: -8, maxZ: 8 };
        this.regions = data.regions || [];
        this.walls = data.walls || [];
        this.obstacles = data.obstacles || [];
        
        // Starting position
        this.startPosition = data.ballStart || { x: 0, z: 0 };
        
        // Holes/pockets (unified)
        this.holes = this.parseHoles(data);
        
        // Dynamic objects (target balls in billiards)
        this.dynamicObjects = this.parseDynamicObjects(data);
        
        // Build data (for rendering)
        this.buildFloors = data.buildFloors || [];
        this.buildWalls = data.buildWalls || [];
        this.buildObstacles = data.buildObstacles || [];
        
        // AI hints
        this.pathHints = data.pathHint || [];
        this.strategicNotes = data.strategicNotes || [];
    }

    /**
     * Auto-detect paradigm from level data
     */
    detectParadigm(data) {
        // If it has pockets (multiple holes), it's billiards
        if (data.pockets && data.pockets.length > 1) {
            return 'billiards';
        }
        // If it has dynamic obstacles (target balls), probably billiards
        if (data.obstacles && data.obstacles.some(o => o.dynamic)) {
            return 'billiards';
        }
        // Default to minigolf
        return 'minigolf';
    }

    /**
     * Parse holes/pockets into unified structure
     */
    parseHoles(data) {
        const holes = [];

        // Billiards: multiple pockets
        if (data.pockets && data.pockets.length > 0) {
            for (const pocket of data.pockets) {
                holes.push({
                    id: pocket.id || 'pocket',
                    x: pocket.x,
                    z: pocket.z,
                    radius: pocket.radius || 1.0,
                    type: 'pocket'
                });
            }
        }
        // Minigolf: single hole
        else if (data.holePosition) {
            holes.push({
                id: 'main',
                x: data.holePosition.x,
                z: data.holePosition.z,
                radius: 0.5,
                type: 'hole'
            });
        }

        return holes;
    }

    /**
     * Parse dynamic objects (target balls, movable obstacles)
     */
    parseDynamicObjects(data) {
        const objects = [];

        if (data.obstacles) {
            for (const obs of data.obstacles) {
                if (obs.dynamic) {
                    objects.push({
                        id: obs.id || 'ball',
                        x: obs.x,
                        z: obs.z,
                        radius: obs.radius || 0.4,
                        color: obs.color || '#ffffff',
                        type: 'ball'
                    });
                }
            }
        }

        return objects;
    }

    /**
     * Validate level data
     */
    validate() {
        const errors = [];

        if (!this.id) errors.push('Missing level id');
        if (!this.name) errors.push('Missing level name');
        if (!this.startPosition) errors.push('Missing ball start position');
        if (this.holes.length === 0) errors.push('No holes/pockets defined');
        if (this.regions.length === 0) errors.push('No playable regions defined');

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if a point is within playable bounds
     */
    isPointPlayable(x, z) {
        return this.regions.some(r =>
            x >= r.minX && x <= r.maxX &&
            z >= r.minZ && z <= r.maxZ
        );
    }

    /**
     * Get the main hole (for compatibility)
     */
    getMainHole() {
        return this.holes[0] || { x: 0, z: 0, radius: 0.5 };
    }

    /**
     * Get all pockets (for billiards)
     */
    getPockets() {
        return this.holes.filter(h => h.type === 'pocket');
    }

    /**
     * Convert to JSON for telemetry
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            paradigm: this.paradigm,
            difficulty: this.difficulty,
            description: this.description,
            bounds: this.bounds,
            regions: this.regions,
            walls: this.walls,
            obstacles: this.obstacles,
            holes: this.holes,
            dynamicObjects: this.dynamicObjects,
            pathHints: this.pathHints
        };
    }
}
