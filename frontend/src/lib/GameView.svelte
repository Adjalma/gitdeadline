<script lang="ts">
  import { onMount } from 'svelte';
  import { gameZone, triggerTimeRefresh } from './stores.js';
  import LifeClock from './LifeClock.svelte';
  import Processos from './Processos.svelte';
  import MapMundi3DGlobe from './MapMundi3DGlobe.svelte';

  export let userId: string;

  async function addBonus(event: string) {
    const res = await fetch(`/api/user/${userId}/bonus?event=${event}`, { method: 'POST', credentials: 'include' });
    if (res.ok) triggerTimeRefresh.update((n) => n + 1);
  }
  let zone: 'dev_null' | 'home_user' | 'root' = 'home_user';

  const unsub = gameZone.subscribe((z) => { zone = z; });

  onMount(() => () => unsub());

  const zoneConfig = {
    dev_null: { label: '/dev/null', color: 'neonred', glow: 'rgba(255,7,58,0.6)' },
    home_user: { label: '/home/user', color: 'phosphor', glow: 'rgba(57,255,20,0.6)' },
    root: { label: '/root', color: 'amber', glow: 'rgba(255,191,0,0.6)' },
  };
  const cfg = zoneConfig[zone] || zoneConfig.home_user;
</script>

<svelte:head>
  <style>
    @keyframes scanline { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.08; } }
    @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px var(--glow); } 50% { box-shadow: 0 0 40px var(--glow); } }
    @keyframes grid-drift { from { background-position: 0 0; } to { background-position: 30px 30px; } }
    .cyber-grid {
      background-image: linear-gradient(rgba(57,255,20,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(57,255,20,0.03) 1px, transparent 1px);
      background-size: 30px 30px;
      animation: grid-drift 60s linear infinite;
    }
    .cidadaela-layer { transition: all 0.3s; }
    .cidadaela-layer.active { filter: drop-shadow(0 0 12px var(--zone-glow)); }
  </style>
</svelte:head>

<div class="min-h-screen bg-[#0a0a0f] text-phosphor cyber-grid">
  <!-- Scanline overlay -->
  <div class="fixed inset-0 pointer-events-none opacity-30 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px]" style="animation: scanline 4s ease-in-out infinite"></div>

  <div class="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-8">
    <!-- HEADER -->
    <header class="flex items-center justify-between border-b border-phosphor/20 pb-4">
      <h1 class="text-lg font-mono tracking-[0.3em] text-phosphor/90">
        GITdeadline<span class="text-black bg-phosphor px-1">_</span>
      </h1>
      <div class="flex items-center gap-4">
        <span class="text-amber/70 text-xs font-mono">CÓDIGO = TEMPO</span>
        <a href="/api/auth/status?logout=1" class="text-phosphor/50 hover:text-phosphor text-xs">
          Sair
        </a>
      </div>
    </header>

    <!-- MAPA: CIDADELA VERTICAL — Edifício em Camadas (conceito) -->
    <section class="rounded-lg overflow-hidden border border-phosphor/30 bg-black/80 backdrop-blur-sm">
      <div class="px-4 py-2 border-b border-phosphor/20 bg-black/60 font-mono text-xs uppercase tracking-widest text-phosphor/70">
        CIDADELA VERTICAL — GIT DEADLINE
      </div>
      <div class="p-6 flex flex-col gap-0">
        <!-- /root — topo dourado -->
        <div
          class="cidadaela-layer flex items-center justify-between px-6 py-4 rounded-t-lg border border-amber/40 bg-gradient-to-r from-amber/20 to-amber/5 {zone === 'root' ? 'active border-amber' : ''}"
          style="--zone-glow: rgba(255,191,0,0.5)"
        >
          <div class="flex items-center gap-3">
            <div class="w-2 h-12 bg-amber rounded-full opacity-80"></div>
            <div>
              <span class="font-mono text-amber font-bold">/root</span>
              <span class="text-amber/60 text-xs ml-2">pristine · Elite</span>
            </div>
          </div>
          {#if zone === 'root'}
            <span class="text-amber text-xs font-bold animate-pulse">← VOCÊ</span>
          {/if}
        </div>

        <!-- /home/user — meio cyan -->
        <div
          class="cidadaela-layer flex items-center justify-between px-6 py-4 border-x border-phosphor/30 border-b border-phosphor/20 bg-gradient-to-r from-phosphor/15 to-phosphor/5 {zone === 'home_user' ? 'active border-phosphor' : ''}"
          style="--zone-glow: rgba(57,255,20,0.5)"
        >
          <div class="flex items-center gap-3">
            <div class="w-2 h-12 bg-phosphor rounded-full opacity-80"></div>
            <div>
              <span class="font-mono text-phosphor font-bold">/home/user</span>
              <span class="text-phosphor/60 text-xs ml-2">stable · use · time</span>
            </div>
          </div>
          {#if zone === 'home_user'}
            <span class="text-phosphor text-xs font-bold animate-pulse">← VOCÊ</span>
          {/if}
        </div>

        <!-- /dev/null — base vermelha -->
        <div
          class="cidadaela-layer flex items-center justify-between px-6 py-4 rounded-b-lg border border-neonred/40 bg-gradient-to-r from-neonred/20 to-neonred/5 {zone === 'dev_null' ? 'active border-neonred' : ''}"
          style="--zone-glow: rgba(255,7,58,0.5)"
        >
          <div class="flex items-center gap-3">
            <div class="w-2 h-12 bg-neonred rounded-full opacity-80"></div>
            <div>
              <span class="font-mono text-neonred font-bold">/dev/null</span>
              <span class="text-neonred/60 text-xs ml-2">low-res · Favela</span>
            </div>
          </div>
          {#if zone === 'dev_null'}
            <span class="text-neonred text-xs font-bold animate-pulse">← VOCÊ</span>
          {/if}
        </div>
      </div>
    </section>

    <!-- LIFE CLOCK — Estilo Smartwatch / wearable -->
    <section class="rounded-3xl overflow-hidden border-2 border-phosphor/40 bg-black/90 p-6"
      style="box-shadow: 0 0 40px rgba(57,255,20,0.12), inset 0 0 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(57,255,20,0.1)"
    >
      <LifeClock {userId} />
    </section>

    <!-- COMMIT SLUMS — Time Banks (estilo distópico) -->
    <section class="rounded-lg overflow-hidden border border-neonred/30 bg-black/90">
      <div class="px-4 py-2 border-b border-neonred/30 bg-neonred/10 font-mono text-xs uppercase tracking-wider text-neonred/90">
        COMMIT SLUMS — TIME BANKS
      </div>
      <div class="p-4 space-y-4">
        <p class="text-phosphor/50 text-xs">Mineração de tempo. PR e Issues concedem vida.</p>
        <div class="flex flex-wrap gap-2">
          <button
            on:click={() => addBonus('commit')}
            class="px-4 py-2 border border-phosphor/50 text-phosphor hover:bg-phosphor/10 text-sm font-mono transition-all hover:shadow-[0_0_15px_rgba(57,255,20,0.3)]"
          >+1h Commit</button>
          <button
            on:click={() => addBonus('pr_merged')}
            class="px-4 py-2 border border-amber/50 text-amber hover:bg-amber/10 text-sm font-mono transition-all hover:shadow-[0_0_15px_rgba(255,191,0,0.3)]"
          >+72h PR</button>
          <button
            on:click={() => addBonus('issue_resolved')}
            class="px-4 py-2 border border-phosphor/50 text-phosphor/80 hover:bg-phosphor/10 text-sm font-mono transition-all"
          >+48h Issue</button>
        </div>
        <p class="text-phosphor/30 text-xs">Webhook GitHub → bônus automático</p>
      </div>
    </section>

    <!-- GLOBO 3D — Git Deadline (escala: milhares a 100k+) -->
    <MapMundi3DGlobe {userId} />

    <!-- PLAYER AVATARS — Processos + Spectator -->
    <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="rounded-lg border border-phosphor/30 bg-black/80 p-4 {zone === 'dev_null' ? 'ring-1 ring-neonred/30' : ''}">
        <div class="text-phosphor/70 text-xs uppercase tracking-widest mb-3">Processos — Espectros de Luz</div>
        <p class="text-phosphor/50 text-xs mb-3">Handshake para transferir tempo (PR token)</p>
        <Processos {userId} />
      </div>
      <div class="rounded-lg border border-phosphor/30 bg-black/80 p-4">
        <div class="text-phosphor/70 text-xs uppercase tracking-widest mb-3">Spectator — Atividade Global</div>
        <p class="text-phosphor/50 text-xs">Pulsações quando alguém dá push.</p>
        <div class="mt-3 space-y-1 text-phosphor/40 text-xs font-mono">
          <div>● Webhook: /api/webhook/github</div>
          <div>● PR merged → +72h · Issue → +48h · Commit → +1h</div>
        </div>
      </div>
    </section>
  </div>
</div>
