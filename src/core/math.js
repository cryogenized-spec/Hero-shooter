export const Math2 = {
                clamp(v, min, max) {
                    return Math.max(min, Math.min(max, v));
                },
                lerp(a, b, t) {
                    return a + (b - a) * t;
                },
                dist(x1, y1, x2, y2) {
                    return Math.hypot(x2 - x1, y2 - y1);
                },
                angle(x1, y1, x2, y2) {
                    return Math.atan2(y2 - y1, x2 - x1);
                },
                angleDiff(a, b) {
                    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
                },
                rand(min, max) {
                    return Math.random() * (max - min) + min;
                },
                randInt(min, max) {
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
            };
