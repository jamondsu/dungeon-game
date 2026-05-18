// ═══════════════════════════════════════════════════════════════════════════
// UTILS.JS - Helper functions and utilities
// ═══════════════════════════════════════════════════════════════════════════

class Utils {
    // RNG seeded random number generator
    static createRng(seed) {
        let state = seed;
        return function() {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }

    // Distance from point to line segment
    static distancePointToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - x1, py - y1);
        let t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        const closestX = x1 + t * dx, closestY = y1 + t * dy;
        return Math.hypot(px - closestX, py - closestY);
    }

    // Distance from point to line (for node arc routing)
    static pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        return Math.hypot(px - projX, py - projY);
    }

    // Check if tile is in world bounds
    static isInBounds(x, y, worldWidth, worldHeight) {
        return x >= 0 && x < worldWidth && y >= 0 && y < worldHeight;
    }

    // Manhattan distance
    static manhattanDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    // Euclidean distance
    static euclideanDistance(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Clamp value between min and max
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Linear interpolation
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}