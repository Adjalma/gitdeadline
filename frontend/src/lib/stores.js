import { writable } from 'svelte/store';

export const gameZone = writable('home_user');
export const gameTime = writable(86400);
