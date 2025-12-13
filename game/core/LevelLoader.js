import { Level } from './Level.js';

/**
 * Loads and validates level JSON files
 */
export class LevelLoader {
    constructor(basePath = './courses/') {
        this.basePath = basePath;
        this.cache = {};
    }

    /**
     * Load a level by ID
     * @param {string} id - Level ID
     * @returns {Promise<Level>}
     */
    async loadLevel(id) {
        // Check cache first
        if (this.cache[id]) {
            return this.cache[id];
        }

        const path = `${this.basePath}${id}.json`;
        
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load level: ${response.statusText}`);
            }

            const data = await response.json();
            const level = new Level(data);

            // Validate
            const validation = level.validate();
            if (!validation.valid) {
                console.warn(`Level validation warnings for ${id}:`, validation.errors);
            }

            // Cache it
            this.cache[id] = level;

            return level;
        } catch (error) {
            console.error(`Error loading level ${id}:`, error);
            throw error;
        }
    }

    /**
     * Load the index of available levels
     * @returns {Promise<Array>}
     */
    async loadIndex() {
        try {
            const response = await fetch(`${this.basePath}index.json`);
            if (!response.ok) {
                return [];
            }
            return await response.json();
        } catch (error) {
            console.warn('Failed to load level index:', error);
            return [];
        }
    }

    /**
     * Preload multiple levels
     * @param {Array<string>} ids - Array of level IDs
     * @returns {Promise<Array<Level>>}
     */
    async preloadLevels(ids) {
        const promises = ids.map(id => this.loadLevel(id));
        return Promise.all(promises);
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache = {};
    }

    /**
     * Get a level from cache (synchronous)
     * @param {string} id - Level ID
     * @returns {Level|null}
     */
    getCached(id) {
        return this.cache[id] || null;
    }
}
