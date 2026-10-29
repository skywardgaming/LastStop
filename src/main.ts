import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-400-italic.css';
import '@fontsource/alegreya/latin-500.css';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/shell.css';
import './ui/styles/components.css';
import './ui/styles/screens.css';
import { acquireTabLock } from './platform/storage';
import { artUrl } from './ui/art';
import { App } from './ui/app';

// Expose the Rebirth UI frames to CSS through BASE_URL-aware variables.
const FRAMES = ['panel_iron', 'panel_selected', 'panel_disabled', 'panel_wood', 'panel_ceramic', 'panel_engineering', 'slot_common', 'slot_uncommon', 'slot_rare', 'progress_amber', 'progress_cyan', 'progress_copper'];
for (const f of FRAMES) document.documentElement.style.setProperty(`--art-${f.replace('_', '-')}`, `url("${artUrl(`ui/${f}.png`)}")`);

async function boot(): Promise<void> {
  // Only one tab may run the game, so offline time is never claimed twice.
  const owner = await acquireTabLock();
  if (!owner) {
    const blocked = document.getElementById('blocked');
    if (blocked) blocked.hidden = false;
    return;
  }
  new App();
}

void boot();
