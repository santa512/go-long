class PixelPerfectCollision {
    constructor() {
        this.masks = new Map();
        this.frameCache = new Map();
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
            willReadFrequently: true
        });
    }
    async extractFramesFromGIF(img, frameCount = 8, frameDuration = 100) {
        return new Promise((resolve) => {
            const frames = [];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = img.naturalWidth || 200;
            canvas.height = img.naturalHeight || 200;
            let currentFrame = 0;
            const captureFrame = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                frames.push({
                    data: imageData,
                    width: canvas.width,
                    height: canvas.height
                });
                currentFrame++;
                if (currentFrame < frameCount) {
                    setTimeout(captureFrame, frameDuration);
                } else {
                    resolve(frames);
                }
            };
            if (img.complete) {
                captureFrame();
            } else {
                img.onload = captureFrame;
            }
        });
    }
    generateCollisionMask(imageData, alphaThreshold = 50) {
        const { width, height, data } = imageData;
        const pixelCount = width * height;
        const wordsPerRow = Math.ceil(width / 32);
        const mask = new Uint32Array(wordsPerRow * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const alpha = data[pixelIndex + 3];
                if (alpha > alphaThreshold) {
                    const wordIndex = y * wordsPerRow + Math.floor(x / 32);
                    const bitIndex = x % 32;
                    mask[wordIndex] |= (1 << bitIndex);
                }
            }
        }
        return {
            data: mask,
            width: width,
            height: height,
            wordsPerRow: wordsPerRow
        };
    }
    generateBoundingBox(imageData, alphaThreshold = 50) {
        const { width, height, data } = imageData;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let hasPixels = false;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                const alpha = data[pixelIndex + 3];
                if (alpha > alphaThreshold) {
                    hasPixels = true;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        if (!hasPixels) {
            return { x: 0, y: 0, width: width, height: height };
        }
        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }
    async precomputeMasks(spriteId, img, options = {}) {
        const {
            frameCount = 8,
            frameDuration = 100,
            alphaThreshold = 50
        } = options;
        try {
            const frames = await this.extractFramesFromGIF(img, frameCount, frameDuration);
            const maskData = frames.map((frame, index) => {
                const mask = this.generateCollisionMask(frame.data, alphaThreshold);
                const bbox = this.generateBoundingBox(frame.data, alphaThreshold);
                return {
                    mask: mask,
                    bbox: bbox,
                    width: frame.width,
                    height: frame.height
                };
            });
            this.masks.set(spriteId, maskData);
            return maskData;
        } catch (error) {
            console.error(`Failed to precompute masks for ${spriteId}:`, error);
            return null;
        }
    }
    checkAABB(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x ||
                rect2.x + rect2.width < rect1.x ||
                rect1.y + rect1.height < rect2.y ||
                rect2.y + rect2.height < rect1.y);
    }
    checkPixelCollision(sprite1Id, frame1, pos1, sprite2Id, frame2, pos2) {
        const masks1 = this.masks.get(sprite1Id);
        const masks2 = this.masks.get(sprite2Id);
        if (!masks1 || !masks2 || !masks1[frame1] || !masks2[frame2]) {
            return this.checkAABB(pos1, pos2);
        }
        const maskData1 = masks1[frame1];
        const maskData2 = masks2[frame2];
        const mask1 = maskData1.mask;
        const mask2 = maskData2.mask;
        if (!this.checkAABB(pos1, pos2)) {
            return false;
        }
        const overlapX1 = Math.max(pos1.x, pos2.x);
        const overlapY1 = Math.max(pos1.y, pos2.y);
        const overlapX2 = Math.min(pos1.x + pos1.width, pos2.x + pos2.width);
        const overlapY2 = Math.min(pos1.y + pos1.height, pos2.y + pos2.height);
        for (let y = Math.floor(overlapY1); y < overlapY2; y++) {
            for (let x = Math.floor(overlapX1); x < overlapX2; x++) {
                const local1X = Math.floor((x - pos1.x) / pos1.width * mask1.width);
                const local1Y = Math.floor((y - pos1.y) / pos1.height * mask1.height);
                const local2X = Math.floor((x - pos2.x) / pos2.width * mask2.width);
                const local2Y = Math.floor((y - pos2.y) / pos2.height * mask2.height);
                if (local1X < 0 || local1X >= mask1.width || local1Y < 0 || local1Y >= mask1.height ||
                    local2X < 0 || local2X >= mask2.width || local2Y < 0 || local2Y >= mask2.height) {
                    continue;
                }
                const pixel1Solid = this.isPixelSolid(mask1, local1X, local1Y);
                const pixel2Solid = this.isPixelSolid(mask2, local2X, local2Y);
                if (pixel1Solid && pixel2Solid) {
                    return true;
                }
            }
        }
        return false;
    }
    isPixelSolid(mask, x, y) {
        const wordIndex = y * mask.wordsPerRow + Math.floor(x / 32);
        const bitIndex = x % 32;
        if (wordIndex >= mask.data.length) {
            return false;
        }
        return (mask.data[wordIndex] & (1 << bitIndex)) !== 0;
    }
    checkSimplifiedCollision(sprite, target) {
        const collisionArea = sprite.collisionArea || sprite;
        return this.checkAABB(collisionArea, {
            x: target.x - target.width / 2,
            y: target.y - target.height / 2,
            width: target.width,
            height: target.height
        });
    }
    debugDrawMask(ctx, spriteId, frame, pos) {
        const masks = this.masks.get(spriteId);
        if (!masks || !masks[frame] || !masks[frame].mask) return;
        const maskData = masks[frame];
        const mask = maskData.mask;
        const scaleX = pos.width / mask.width;
        const scaleY = pos.height / mask.height;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        for (let y = 0; y < mask.height; y++) {
            for (let x = 0; x < mask.width; x++) {
                if (this.isPixelSolid(mask, x, y)) {
                    ctx.fillRect(
                        pos.x + x * scaleX,
                        pos.y + y * scaleY,
                        scaleX,
                        scaleY
                    );
                }
            }
        }
        ctx.restore();
    }
}
window.collisionSystem = new PixelPerfectCollision();
