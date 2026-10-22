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
// Phaser 3.60 redraws a Text's canvas and re-uploads it to the GPU on every setColor / setStroke, even when the
// value is the one it already has. The HUD sets them every frame, so skip the no-op calls (about 18 GPU uploads
// a frame in a Tower fight before this).
if (typeof Phaser !== 'undefined' && Phaser.GameObjects?.Text) {   // (Phaser may not be loaded yet)
    const TP = Phaser.GameObjects.Text.prototype, setColor = TP.setColor, setStroke = TP.setStroke;
    TP.setColor = function (c) { return this.style && this.style.color === c ? this : setColor.call(this, c); };
    TP.setStroke = function (c, t) { const s = this.style; return s && c !== undefined && s.stroke === c && s.strokeThickness === (t === undefined ? s.strokeThickness : t) ? this : setStroke.call(this, c, t); };
}
// Phaser 3.60's WebGL Graphics makes every arc 100 points whatever its size (a rounded rect is 400) and runs earcut on
// every filled path, every frame, drawn or redrawn. A convex one (circles, rounded rects, most fills) is drawn as a fan
// instead, points under half a pixel apart on screen dropped. Anything else still goes to earcut.
if (typeof Phaser !== 'undefined' && Phaser.Renderer?.WebGL?.Pipelines?.MultiPipeline) {
    const MP = Phaser.Renderer.WebGL.Pipelines.MultiPipeline.prototype, earcutFill = MP.batchFillPath, xs = [], ys = [];
    MP.batchFillPath = function (path, currentMatrix, parentMatrix) {
        const n = path.length;
        if (n < 8) return earcutFill.call(this, path, currentMatrix, parentMatrix);   // a few points: earcut is cheap
        this.renderer.pipelines.set(this);
        const m = this.calcMatrix;
        if (parentMatrix) parentMatrix.multiply(currentMatrix, m);
        let k = 0;
        for (let i = 0; i < n; i++) {
            const p = path[i], x = m.getX(p.x, p.y), y = m.getY(p.x, p.y);
            if (k && (x - xs[k - 1]) ** 2 + (y - ys[k - 1]) ** 2 < 0.25) continue;
            xs[k] = x; ys[k] = y; k++;
        }
        if (k > 2 && (xs[k - 1] - xs[0]) ** 2 + (ys[k - 1] - ys[0]) ** 2 < 0.25) k--;   // closed back onto its start
        // convex: every turn the same way, and it goes round once (dx and dy each change sign twice at most: not a star)
        let turn = 0, sx = 0, sy = 0, cx = 0, cy = 0;
        for (let i = 0; i < k; i++) {
            const a = (i + 1) % k, b = (i + 2) % k, ex = xs[a] - xs[i], ey = ys[a] - ys[i];
            const c = ex * (ys[b] - ys[a]) - ey * (xs[b] - xs[a]);
            if (c > 1e-4 || c < -1e-4) { const s = c > 0 ? 1 : -1; if (turn && s !== turn) return earcutFill.call(this, path, currentMatrix, parentMatrix); turn = s; }
            if (ex > 1e-6 || ex < -1e-6) { const s = ex > 0 ? 1 : -1; if (sx && s !== sx) cx++; sx = s; }
            if (ey > 1e-6 || ey < -1e-6) { const s = ey > 0 ? 1 : -1; if (sy && s !== sy) cy++; sy = s; }
        }
        if (cx > 2 || cy > 2) return earcutFill.call(this, path, currentMatrix, parentMatrix);
        const t = this.fillTint;
        for (let i = 1; i < k - 1; i++) this.batchTri(null, xs[0], ys[0], xs[i], ys[i], xs[i + 1], ys[i + 1], 0, 0, 1, 1, t.TL, t.TR, t.BL, 2);
    };
    // and a stroke is a quad and a join for every one of those points: the same half pixel thins it (ends kept)
    const stroke = MP.batchStrokePath, kept = [];
    MP.batchStrokePath = function (path, lineWidth, pathOpen, currentMatrix, parentMatrix) {
        const n = path.length;
        if (n < 8) return stroke.call(this, path, lineWidth, pathOpen, currentMatrix, parentMatrix);
        const m = this.calcMatrix;
        if (parentMatrix) parentMatrix.multiply(currentMatrix, m);
        const d2 = 0.25 / (Math.abs(m.a * m.d - m.b * m.c) || 1);   // half a screen pixel, squared, in the path's units
        let last = path[0]; kept.length = 0; kept.push(last);
        for (let i = 1; i < n - 1; i++) { const p = path[i]; if ((p.x - last.x) ** 2 + (p.y - last.y) ** 2 >= d2) { kept.push(p); last = p; } }
        kept.push(path[n - 1]);
        stroke.call(this, kept, lineWidth, pathOpen, currentMatrix, parentMatrix);
        kept.length = 0;
    };
}
