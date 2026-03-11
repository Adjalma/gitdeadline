import { writable } from 'svelte/store';

export const gameZone = writable('home_user');
export const gameTime = writable(86400);
/** Disparo para LifeClock refetch imediato (ex: após bônus) */
export const triggerTimeRefresh = writable(0);
/** Disparo para MapMundi/MapMundi3D refetch (ex: após sync) */
export const triggerMapRefresh = writable(0);
