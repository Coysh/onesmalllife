import Alpine from 'alpinejs';
import { initSettings } from '../game/settings/settings';

window.Alpine = Alpine;
Alpine.start();

// Apply persisted player settings (reduce motion, text size, contrast, volumes)
// on every page, and wire any settings form present.
initSettings();
