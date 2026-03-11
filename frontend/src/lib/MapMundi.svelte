<script lang="ts">
  import { onMount } from 'svelte';

  export let userId: string;

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

  const zoneColors: Record<Zone, string> = {
    dev_null: '#ff073a',
    home_user: '#39ff14',
    root: '#ffbf00',
  };

  const zoneLabels: Record<Zone, string> = {
    dev_null: '/dev/null',
    home_user: '/home/user',
    root: '/root',
  };

  function buildingSize(hours: number): number {
    if (hours <= 0) return 4;
    const log = Math.log10(hours + 1);
    return Math.min(24, Math.max(6, log * 8));
  }

  function formatHours(h: number): string {
    if (h >= 1e9) return (h / 1e9).toFixed(1) + 'B';
    if (h >= 1e6) return (h / 1e6).toFixed(1) + 'M';
    if (h >= 1e3) return (h / 1e3).toFixed(1) + 'k';
    return String(Math.floor(h));
  }

  async function fetchMap() {
    try {
      const res = await fetch('/api/ranking?map=1&limit=200');
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

  function zoneX(zone: Zone): number {
    if (zone === 'dev_null') return 25;
    if (zone === 'home_user') return 50;
    return 75;
  }

  onMount(() => {
    fetchMap();
    const iv = setInterval(fetchMap, 15000);
    return () => clearInterval(iv);
  });
</script>

<div class="border border-phosphor/30 rounded overflow-hidden">
  <div class="flex items-center justify-between px-4 py-2 border-b border-phosphor/20 bg-black/60">
    <span class="text-phosphor/80 text-xs uppercase tracking-widest">MAPA MUNDI — THE GIT CITY</span>
    <span class="text-phosphor/60 text-xs">
      {onlineCount} online · {users.length} jogadores
    </span>
  </div>
  <div class="relative p-4 min-h-[280px] bg-black/40">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center text-phosphor/50 text-sm">
        Carregando mapa...
      </div>
    {:else}
      <!-- Zonas do mundo: 3 regiões horizontais -->
      <svg viewBox="0 0 100 100" class="w-full h-64" preserveAspectRatio="xMidYMid meet">
        <!-- Regiões por zona -->
        <rect x="0" y="60" width="100" height="40" fill="rgba(255,7,58,0.08)" stroke="rgba(255,7,58,0.4)" stroke-width="0.5"/>
        <rect x="0" y="25" width="100" height="35" fill="rgba(57,255,20,0.06)" stroke="rgba(57,255,20,0.4)" stroke-width="0.5"/>
        <rect x="0" y="0" width="100" height="25" fill="rgba(255,191,0,0.1)" stroke="rgba(255,191,0,0.5)" stroke-width="0.5"/>
        <!-- Labels zonas -->
        <text x="2" y="12" font-size="3" fill="#ffbf00" font-family="monospace">/root</text>
        <text x="2" y="44" font-size="3" fill="#39ff14" font-family="monospace">/home/user</text>
        <text x="2" y="82" font-size="3" fill="#ff073a" font-family="monospace">/dev/null</text>
        <!-- Usuários como edifícios: altura = tempo acumulado -->
        {#each users as u, i}
          {@const col = Math.floor(i / 8)}
          {@const zoneTop = u.zone === 'dev_null' ? 60 : u.zone === 'home_user' ? 25 : 0}
          {@const zoneH = u.zone === 'dev_null' ? 40 : u.zone === 'home_user' ? 35 : 25}
          {@const x = 8 + (col % 12) * 7.5}
          {@const yBase = zoneTop + zoneH / 2}
          {@const size = buildingSize(u.hours)}
          {@const y = yBase - size / 2}
          <g>
            <rect
              x={x} y={y}
              width="5" height={size}
              fill={zoneColors[u.zone]}
              opacity={u.online ? 0.9 : 0.4}
              stroke={u.online ? '#fff' : 'none'}
              stroke-width="0.3"
            />
            {#if u.user_id === userId}
              <rect x={x - 0.5} y={y - 1} width="6" height="1.5" fill="#fff" opacity="0.9"/>
            {/if}
          </g>
        {/each}
      </svg>
      <!-- Legenda: edifício = tempo -->
      <div class="mt-2 flex flex-wrap gap-4 text-phosphor/50 text-xs">
        <span>● Online</span>
        <span>○ Offline</span>
        <span>▮ Altura = tempo (histórico GitHub)</span>
      </div>
      <!-- Lista de usuários online -->
      {#if onlineCount > 0}
        <div class="mt-3 pt-3 border-t border-phosphor/20">
          <span class="text-phosphor/70 text-xs uppercase">Conectados agora:</span>
          <div class="flex flex-wrap gap-2 mt-1">
            {#each users.filter((u) => u.online) as u}
              <span
                class="px-2 py-0.5 rounded border {u.user_id === userId ? 'border-phosphor bg-phosphor/20 text-phosphor' : 'border-phosphor/40 text-phosphor/80'} text-xs font-mono"
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
