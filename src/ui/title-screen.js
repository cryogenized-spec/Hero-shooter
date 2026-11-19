/** Start menu controls for the selected static 16:9 anime title screen. */
const STORE = 'hero-shooter:last-chapter';
const MUSIC = 'hero-shooter:music-on-start';
const CAMPAIGNS = new Set(['training', 'mall', 'cbd', 'sniper', 'suburbs']);

function readPreference(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
}
function savePreference(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* private storage: game still works */ }
}

export function setupTitleScreen({ start, continueChapter }) {
    const screen = document.getElementById('titleScreen');
    const options = document.getElementById('titleOptionsDialog');
    const checkbox = document.getElementById('titleMusicPref');
    const chapterOverlay = document.getElementById('startOverlay');
    chapterOverlay.inert = true;
    const startButton = document.getElementById('titleStart');
    const continueButton = document.getElementById('titleContinue');
    const optionsButton = document.getElementById('titleOptions');
    checkbox.checked = readPreference(MUSIC) === 'true';

    const showChapterSelect = (kind) => {
        if (screen.classList.contains('hidden')) return;
        screen.classList.add('hidden');
        options.classList.add('hidden');
        chapterOverlay.inert = false;
        if (kind === 'continue') {
            const previous = readPreference(STORE);
            continueChapter(CAMPAIGNS.has(previous) ? previous : 'training');
        } else {
            start();
        }
        document.getElementById('startBtn').focus({ preventScroll: true });
    };
    const openOptions = () => {
        options.classList.remove('hidden');
        screen.inert = true;
        checkbox.focus({ preventScroll: true });
    };
    const closeOptions = () => {
        options.classList.add('hidden');
        screen.inert = false;
        optionsButton.focus({ preventScroll: true });
    };

    startButton.addEventListener('click', () => showChapterSelect('start'));
    document.getElementById('titlePressStart').addEventListener('click', () => showChapterSelect('start'));
    continueButton.addEventListener('click', () => showChapterSelect('continue'));
    optionsButton.addEventListener('click', openOptions);
    document.getElementById('titleOptionsBack').addEventListener('click', closeOptions);
    checkbox.addEventListener('change', () => savePreference(MUSIC, String(checkbox.checked)));
    document.getElementById('titleFullscreen').addEventListener('click', async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch { /* Fullscreen is not available on every mobile browser. */ }
    });
    document.addEventListener('keydown', (event) => {
        if (!options.classList.contains('hidden')) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeOptions();
            }
            return;
        }
        if (screen.classList.contains('hidden')) return;
        if ((event.key === 'Enter' || event.key === ' ') && event.target === document.body) {
            event.preventDefault();
            showChapterSelect('start');
        }
    });

    return {
        rememberChapter(chapter) {
            if (CAMPAIGNS.has(chapter)) savePreference(STORE, chapter);
        },
        musicOnStart() { return readPreference(MUSIC) === 'true'; }
    };
}
