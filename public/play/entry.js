/* Lightweight Home & More bootstrap.
 * The original five-chapter action engine is retained in game.js, not loaded
 * on the Sunday prologue path. This keeps the approved title -> shop flow small.
 */
(function (root) {
    'use strict';
    const query = new URLSearchParams(root.location.search);
    const titleRelative = root.location.pathname.includes('/public/play/') ? '../../' : '../';
    const titleUrl = new URL(titleRelative, root.location.href);

    // The main illustrated title is the single public entry point.
    if (query.get('autostart') !== '1') {
        root.location.replace(titleUrl.href);
        return;
    }

    function showBootFailure(error) {
        const message = error && error.message ? error.message : String(error);
        const notice = root.document.getElementById('shopNotice');
        if (notice) {
            notice.textContent = 'The shop could not start: ' + message;
            notice.style.color = '#fecaca';
        }
        const layer = root.document.getElementById('shopLayer');
        if (layer) layer.hidden = false;
        root.console.error('[Hero Shooter / Sunday] Game initialization failed:', error);
    }

    function init() {
        try {
            const canvas = root.document.getElementById('gameCanvas');
            if (!canvas || !root.HeroShop || !root.HeroSprites)
                throw new Error('Required game canvas or character modules are missing');

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('The browser cannot create a 2D game canvas');

            root.document.body.classList.add('shop-mode');
            const input = {
                keys: Object.create(null),
                leftStick: { active: false, dx: 0, dy: 0 }
            };
            function resize() {
                canvas.width = root.innerWidth;
                canvas.height = root.innerHeight;
            }
            resize();
            root.addEventListener('resize', resize);
            root.addEventListener('blur', () => {
                for (const key of Object.keys(input.keys)) input.keys[key] = false;
            });

            root.openMenu = () => {
                root.HeroShop.stop();
                root.location.assign(titleUrl.href);
            };

            root.addEventListener('keydown', event => {
                const inForm = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
                if (inForm) return;
                const capture = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
                if (capture.includes(event.code) && root.document.getElementById('shopConversation')?.hidden)
                    event.preventDefault();
                input.keys[event.code] = true;
                if (!event.repeat) root.HeroShop.keydown(event.code);
            });
            root.addEventListener('keyup', event => { input.keys[event.code] = false; });
            // The optional armory test can exercise round consumption without
            // changing peaceful story interactions or NPC behaviour.
            if (query.get('armoryTest') === '1') {
                canvas.addEventListener('pointerdown', event => {
                    if (event.button === 0) root.HeroShop.testUseEquipped();
                });
            }

            // Keep the loop alive while JSON is loading; start() shows its own
            // loading/error state until the actual map has been fetched.
            let previous = root.performance.now();
            function frame(timestamp) {
                try {
                    const dt = Math.min(0.05, Math.max(0, (timestamp - previous) / 1000));
                    previous = timestamp;
                    root.HeroShop.frame(dt, {
                        ctx, width: canvas.width, height: canvas.height, input
                    });
                    root.requestAnimationFrame(frame);
                } catch (error) {
                    showBootFailure(error);
                }
            }

            // Defer startup until DOM is fully available and listeners in
            // shop.js have been attached by DOMContentLoaded.
            root.HeroShop.start();
            root.requestAnimationFrame(frame);
        } catch (error) {
            showBootFailure(error);
        }
    }

    if (root.document.readyState === 'loading')
        root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})(window);
