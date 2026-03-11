<script lang="ts">
  import { onMount } from 'svelte';
  import { triggerMapRefresh, triggerTimeRefresh } from './stores.js';

  export let userId: string;
  let unsubMap: (() => void) | undefined;

  type Zone = 'dev_null' | 'home_user' | 'root';
  interface MapUser {
    user_id: string;
    hours: number;
    rank: number;
    zone: Zone;
    online: boolean;
  }

  let users: MapUser[] = [];
  let onlineCount = 0;
  let loading = true;

  const zoneConfig: Record<Zone, { color: string; glow: string; label: string; status: string }> = {
    root: { color: '#ffbf00', glow: 'rgba(255,191,0,0.6)', label: '/root', status: 'pristine' },
    home_user: { color: '#39ff14', glow: 'rgba(57,255,20,0.6)', label: '/home/user', status: 'stable' },
    dev_null: { color: '#ff073a', glow: 'rgba(255,7,58,0.6)', label: '/dev/null', status: 'low-res' },
  };

  function buildingSize(hours: number): number {
    if (hours <= 0) return 4;
    const log = Math.log10(hours + 1);
    return Math.min(28, Math.max(8, log * 10));
  }

  function formatHours(h: number): string {
    if (h >= 1e9) return (h / 1e9).toFixed(1) + 'B';
    if (h >= 1e6) return (h / 1e6).toFixed(1) + 'M';
    if (h >= 1e3) return (h / 1e3).toFixed(1) + 'k';
    return String(Math.floor(h));
  }

  async function fetchMap() {
    try {
      const url = `/api/ranking?map=1&limit=200${userId ? `&ping=${encodeURIComponent(userId)}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      try {
        const data = text ? JSON.parse(text) : {};
        users = data.users ?? [];
        onlineCount = data.online_count || 0;
      } catch (_) {
        users = [];
      }
    } catch (_) {
      users = [];
    } finally {
      loading = false;
    }
  }

  function usersByZone(zone: Zone) {
    return users.filter((u) => u.zone === zone);
  }

  async function syncAndRefresh() {
    if (!userId) return;
    try {
      const res = await fetch(`/api/user/${userId}/init?sync=1`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        triggerTimeRefresh.update((n) => n + 1);
        triggerMapRefresh.update((n) => n + 1);
      }
      await fetchMap();
    } catch (_) {}
  }

  onMount(() => {
    fetchMap();
    unsubMap = triggerMapRefresh.subscribe((v) => {
      if (v > 0) fetchMap();
    });
    const iv = setInterval(fetchMap, 15000);
    return () => {
      clearInterval(iv);
      unsubMap?.();
    };
  });
</script>

<svelte:head>
  <style>
    @keyframes neon-pulse { 0%, 100% { opacity: 0.8; filter: brightness(1); } 50% { opacity: 1; filter: brightness(1.2); } }
    @keyframes glitch { 0% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(2px, -2px); } 60% { transform: translate(-2px, -2px); } 80% { transform: translate(2px, 2px); } 100% { transform: translate(0); } }
    @keyframes data-stream { 0% { transform: translateX(-100%); opacity: 0.3; } 50% { opacity: 0.6; } 100% { transform: translateX(100%); opacity: 0.3; } }
    .map-punk { box-shadow: 0 0 30px rgba(57,255,20,0.15), inset 0 0 60px rgba(0,0,0,0.5); }
    .tier-glow { box-shadow: 0 0 20px var(--tier-glow), inset 0 1px 0 rgba(255,255,255,0.05); }
    .building-online { box-shadow: 0 0 12px currentColor; animation: neon-pulse 2s ease-in-out infinite; }
    .stream-line { animation: data-stream 3s ease-in-out infinite; }
  </style>
</svelte:head>

<div class="map-punk border-2 border-phosphor/40 rounded-lg overflow-hidden bg-[#08080c]">
  <!-- Header punk -->
  <div class="flex items-center justify-between px-4 py-3 border-b-2 border-phosphor/30 bg-black/80">
    <span class="text-phosphor font-mono text-sm font-bold uppercase tracking-[0.25em]">
      MAPA MUNDI — <span class="text-amber">GIT DEADLINE</span>
    </span>
    <span class="text-phosphor/70 text-xs font-mono tabular-nums">
      <span class="text-phosphor">{onlineCount}</span> online · <span class="text-phosphor">{users.length}</span> jogadores
    </span>
  </div>

  <div class="relative p-4 min-h-[320px] bg-gradient-to-b from-black/90 to-[#0a0a12]">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-phosphor/50 font-mono text-sm animate-pulse">Carregando...</span>
      </div>
    {:else}
      <!-- Pirâmide 3 níveis — visual punk inspirado em data center -->
      <div class="space-y-0">
        <!-- /root — Topo dourado, crystalline -->
        <div
          class="tier-glow relative overflow-hidden rounded-t-xl border-2 border-amber/50 bg-gradient-to-b from-amber/25 to-amber/5 pt-4 pb-6 px-4"
          style="--tier-glow: rgba(255,191,0,0.25)"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="font-mono text-amber font-bold text-sm">/root</span>
            <span class="text-amber/60 text-[10px] font-mono">pristine · Elite</span>
          </div>
          <div class="flex flex-wrap gap-2 items-end min-h-[48px]">
            {#each usersByZone('root') as u}
              {@const h = buildingSize(u.hours)}
              <div
                class="relative rounded-t group"
                class:building-online={u.online}
                style="width: 20px; height: {h}px; background: linear-gradient(to top, {zoneConfig.root.color}80, {zoneConfig.root.color}); color: {zoneConfig.root.color}; opacity: {u.online ? 1 : 0.45};"
              >
                {#if userId && u.user_id === userId.toLowerCase()}
                  <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-white rounded-full" title="você"></div>
                {/if}
                <span class="absolute -bottom-5 left-0 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[60px]" style="color: {zoneConfig.root.color}">{u.user_id}</span>
              </div>
            {/each}
            {#if usersByZone('root').length === 0}
              <span class="text-amber/40 text-xs font-mono">— vazio —</span>
            {/if}
          </div>
        </div>

        <!-- /home/user — Meio verde neon, data streams -->
        <div
          class="tier-glow relative overflow-hidden border-x-2 border-b border-phosphor/40 bg-gradient-to-b from-phosphor/20 to-phosphor/5 py-4 px-4"
          style="--tier-glow: rgba(57,255,20,0.2)"
        >
          <div class="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
            <div class="absolute w-full h-px bg-phosphor/50 stream-line" style="top: 30%"></div>
            <div class="absolute w-full h-px bg-phosphor/30 stream-line" style="top: 60%; animation-delay: 0.5s"></div>
          </div>
          <div class="flex items-center justify-between mb-3 relative">
            <span class="font-mono text-phosphor font-bold text-sm">/home/user</span>
            <span class="text-phosphor/50 text-[10px] font-mono">stable · use · time</span>
          </div>
          <div class="flex flex-wrap gap-2 items-end min-h-[56px] relative">
            {#each usersByZone('home_user') as u}
              {@const h = buildingSize(u.hours)}
              <div
                class="relative rounded-t group"
                class:building-online={u.online}
                style="width: 22px; height: {h}px; background: linear-gradient(to top, {zoneConfig.home_user.color}90, {zoneConfig.home_user.color}); color: {zoneConfig.home_user.color}; opacity: {u.online ? 1 : 0.5};"
              >
                {#if userId && u.user_id === userId.toLowerCase()}
                  <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-white rounded-full" title="você"></div>
                {/if}
                <span class="absolute -bottom-5 left-0 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[60px]" style="color: {zoneConfig.home_user.color}">{u.user_id}</span>
              </div>
            {/each}
            {#if usersByZone('home_user').length === 0}
              <span class="text-phosphor/40 text-xs font-mono">— vazio —</span>
            {/if}
          </div>
        </div>

        <!-- /dev/null — Base vermelha, warnings, glitch -->
        <div
          class="tier-glow relative overflow-hidden rounded-b-xl border-2 border-neonred/50 bg-gradient-to-b from-neonred/20 to-neonred/5 py-4 px-4"
          style="--tier-glow: rgba(255,7,58,0.2)"
        >
          <div class="absolute top-2 right-4 flex gap-1 opacity-60">
            <span class="text-neonred text-[10px]">⚠</span>
            <span class="text-neonred text-[10px]">⚠</span>
          </div>
          <div class="flex items-center justify-between mb-3">
            <span class="font-mono text-neonred font-bold text-sm">/dev/null</span>
            <span class="text-neonred/50 text-[10px] font-mono">red warnings · low-res</span>
          </div>
          <div class="flex flex-wrap gap-2 items-end min-h-[56px]">
            {#each usersByZone('dev_null') as u}
              {@const h = buildingSize(u.hours)}
              <div
                class="relative rounded-t group"
                class:building-online={u.online}
                style="width: 20px; height: {h}px; background: linear-gradient(to top, {zoneConfig.dev_null.color}80, {zoneConfig.dev_null.color}); color: {zoneConfig.dev_null.color}; opacity: {u.online ? 1 : 0.4};"
              >
                {#if userId && u.user_id === userId.toLowerCase()}
                  <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-white rounded-full" title="você"></div>
                {/if}
                <span class="absolute -bottom-5 left-0 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[60px]" style="color: {zoneConfig.dev_null.color}">{u.user_id}</span>
              </div>
            {/each}
            {#if usersByZone('dev_null').length === 0}
              <span class="text-neonred/40 text-xs font-mono">— vazio —</span>
            {/if}
          </div>
        </div>
      </div>

      {#if users.length === 0}
        <div class="mt-4 p-4 rounded-lg border border-amber/40 bg-amber/5">
          <p class="text-amber/90 text-sm font-mono font-bold">Mapa vazio — Nenhum jogador no ranking</p>
          <p class="text-phosphor/70 text-xs mt-2">
            Use o token <strong>DEFAULT</strong> (não Read-Only) no Upstash. Depois, re-sincronize para aparecer no mapa.
          </p>
          <button
            on:click={syncAndRefresh}
            class="mt-3 px-4 py-2 border border-phosphor/50 text-phosphor hover:bg-phosphor/10 text-xs font-mono transition-all"
          >
            Re-sincronizar para aparecer no mapa
          </button>
        </div>
      {/if}

      <!-- Legenda punk -->
      <div class="mt-4 flex flex-wrap gap-6 text-phosphor/60 text-xs font-mono">
        <span><span class="text-phosphor">●</span> Online</span>
        <span><span class="text-phosphor/50">○</span> Offline</span>
        <span>▮ Altura = tempo (GitHub)</span>
      </div>

      <!-- Conectados agora -->
      {#if onlineCount > 0}
        <div class="mt-4 pt-4 border-t border-phosphor/20">
          <span class="text-phosphor/80 text-[10px] font-mono uppercase tracking-widest">Conectados:</span>
          <div class="flex flex-wrap gap-2 mt-2">
            {#each users.filter((u) => u.online) as u}
              <span
                class="px-2 py-1 rounded border text-xs font-mono {userId && u.user_id === userId.toLowerCase() ? 'border-phosphor bg-phosphor/15 text-phosphor' : 'border-phosphor/30 text-phosphor/80'}"
              >
                {u.user_id}
                <span class="text-phosphor/50 ml-1">({formatHours(u.hours)}h)</span>
              </span>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
