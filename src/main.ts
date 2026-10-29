import './styles.css';
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
