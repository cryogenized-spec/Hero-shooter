/* Public title entry point.
 * The legacy five-chapter engine remains in src/main.js, but must not run
 * behind the approved static menu artwork.
 */
import { setupTitleScreen } from './ui/title-screen.js';

setupTitleScreen({
    start() { /* Retired chapter picker intentionally has no public entry. */ },
    continueChapter() { /* See the preserved legacy engine for historical flows. */ }
});
