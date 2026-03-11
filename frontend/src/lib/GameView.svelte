<script lang="ts">
  import { onMount } from 'svelte';
  import { gameZone } from './stores.js';
  import LifeClock from './LifeClock.svelte';
  import Processos from './Processos.svelte';
  import MapMundi from './MapMundi.svelte';

  export let userId: string;
  let zone: 'dev_null' | 'home_user' | 'root' = 'home_user';

  const unsub = gameZone.subscribe((z) => { zone = z; });

  onMount(() => () => unsub());

  const zoneConfig = {
    dev_null: {
      label: '/dev/null',
      desc: 'A Favela — Ganhe tempo ou petrifique.',
      class: 'zone-devnull',
      bgClass: 'bg-devnull',
    },
    home_user: {
      label: '/home/user',
      desc: 'Classe Média — Interface estável.',
      class: 'zone-home',
      bgClass: 'bg-home',
    },
    root: {
      label: '/root',
      desc: 'A Elite — Alta definição, partículas douradas.',
      class: 'zone-root',
      bgClass: 'bg-root',
    },
  };
  const cfg = zoneConfig[zone] || zoneConfig.home_user;
</script>

<svelte:head>
  <style>
    .zone-devnull { --zone-color: #ff073a; --zone-bg: rgba(255,7,58,0.05); filter: grayscale(30%); }
    .zone-devnull .glitch { animation: glitch 0.3s infinite; }
    @keyframes glitch {
      0%, 100% { transform: translate(0); }
      20% { transform: translate(-2px, 2px); }
      40% { transform: translate(2px, -2px); }
      60% { transform: translate(-2px, -2px); }
      80% { transform: translate(2px, 2px); }
    }
    .zone-home { --zone-color: #39ff14; --zone-bg: rgba(57,255,20,0.03); }
    .zone-root { --zone-color: #ffbf00; --zone-bg: rgba(255,191,0,0.08); }
    .zone-root .particles { background-image: radial-gradient(circle, rgba(255,191,0,0.2) 1px, transparent 1px); background-size: 20px 20px; animation: drift 20s linear infinite; }
    @keyframes drift { from { background-position: 0 0; } to { background-position: 20px 20px; } }
    .code-rain { font-size: 10px; opacity: 0.15; line-height: 1.2; font-family: monospace; overflow: hidden; }
  </style>
</svelte:head>

<div class="game-container {cfg.class} relative min-h-screen">
  <!-- Fundo dinâmico: linhas de código fluindo -->
  <div class="code-rain fixed inset-0 pointer-events-none select-none overflow-hidden">
    {#each Array(15) as _, i}
      <div class="animate-pulse opacity-20 font-mono text-[10px] leading-relaxed" style="animation-delay: {i * 0.3}s">
        const life = {i} * 3600; git push origin main; // mining time
      </div>
    {/each}
  </div>

  <!-- Mapa: Cidadela Vertical -->
  <div class="relative z-10 p-6">
    <div class="max-w-4xl mx-auto">
      <div class="border border-phosphor/20 rounded overflow-hidden mb-6">
        <div class="text-phosphor/60 text-xs uppercase tracking-wider px-4 py-2 border-b border-phosphor/20 bg-black/50">
          CIDADELA VERTICAL — MAPA
        </div>
        <div class="flex flex-col">
          <!-- /root (topo) -->
          <div class="flex items-center gap-4 px-4 py-3 border-b border-amber/20 {zone === 'root' ? 'bg-amber/10' : 'bg-black/30'}">
            <span class="text-amber font-mono text-sm">/root</span>
            <span class="text-amber/60 text-xs">pristine — Elite</span>
            {#if zone === 'root'}
              <span class="ml-auto text-amber text-xs">← VOCÊ</span>
            {/if}
          </div>
          <!-- /home/user -->
          <div class="flex items-center gap-4 px-4 py-3 border-b border-phosphor/20 {zone === 'home_user' ? 'bg-phosphor/10' : 'bg-black/30'}">
            <span class="text-phosphor font-mono text-sm">/home/user</span>
            <span class="text-phosphor/60 text-xs">stable</span>
            {#if zone === 'home_user'}
              <span class="ml-auto text-phosphor text-xs">← VOCÊ</span>
            {/if}
          </div>
          <!-- /dev/null -->
          <div class="flex items-center gap-4 px-4 py-3 {zone === 'dev_null' ? 'bg-neonred/10' : 'bg-black/30'}">
            <span class="text-neonred font-mono text-sm">/dev/null</span>
            <span class="text-neonred/60 text-xs">low-res — Favela</span>
            {#if zone === 'dev_null'}
              <span class="ml-auto text-neonred text-xs">← VOCÊ</span>
            {/if}
          </div>
        </div>
      </div>

      <!-- Relógio de Vida (central) -->
      <LifeClock {userId} />

      <!-- Ações: Mineração de Vida -->
      <div class="mt-6 border border-phosphor/30 p-4">
        <div class="text-phosphor/70 text-xs uppercase tracking-wider mb-3">Mineração de Vida</div>
        <div class="flex flex-wrap gap-2">
          <button
            on:click={async () => { await fetch(`/api/user/${userId}/bonus?event=commit`, { method: 'POST' }); }}
            class="px-4 py-2 border border-phosphor/50 text-phosphor hover:bg-phosphor/10 text-sm font-mono"
          >
            +1h Commit
          </button>
          <button
            on:click={async () => { await fetch(`/api/user/${userId}/bonus?event=pr_merged`, { method: 'POST' }); }}
            class="px-4 py-2 border border-amber/50 text-amber hover:bg-amber/10 text-sm font-mono"
          >
            +72h PR
          </button>
          <button
            on:click={async () => { await fetch(`/api/user/${userId}/bonus?event=issue_resolved`, { method: 'POST' }); }}
            class="px-4 py-2 border border-phosphor/50 text-phosphor/80 hover:bg-phosphor/10 text-sm font-mono"
          >
            +48h Issue
          </button>
        </div>
        <p class="text-phosphor/40 text-xs mt-2">Configure o Webhook do GitHub para bônus automático.</p>
      </div>

      <!-- Mapa Mundi — The Git City 24x7 -->
      <div class="mt-6">
        <MapMundi {userId} />
      </div>

      <!-- Processos + Spectator -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="border border-phosphor/30 p-4 {zone === 'dev_null' ? 'glitch' : ''}">
          <Processos {userId} />
        </div>
        <div class="border border-phosphor/30 p-4">
          <div class="text-phosphor/70 text-xs uppercase tracking-wider mb-3">Spectator — Atividade Global</div>
          <p class="text-phosphor/50 text-xs">Pulsações de luz quando alguém dá push no mundo.</p>
          <div class="mt-3 space-y-1 text-phosphor/40 text-xs font-mono">
            <div>● Configure webhook: /api/webhook/github</div>
            <div>● PR merged → +72h | Issue closed → +48h</div>
            <div>● Commit → +1h (cooldown 1h)</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
