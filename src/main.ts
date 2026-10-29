import './styles.css';
import { acquireTabLock } from './platform/storage';
import { App } from './ui/app';

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
