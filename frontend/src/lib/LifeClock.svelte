<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameZone, triggerTimeRefresh } from './stores.js';

  export let userId: string;

  let timeSecs: number | null = null;
  let ws: WebSocket | null = null;
  let connected = false;
  let zone: 'dev_null' | 'home_user' | 'root' = 'home_user';
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  const usePolling = import.meta.env.PROD;

  function formatTime(secs: number) {
    if (secs <= 0) return { days: 0, hrs: 0, min: 0, sec: 0, compact: '' };
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    let compact = '';
    if (secs >= 86400 * 1e6) compact = (secs / 3600 / 1e9).toFixed(1) + 'B h';
    else if (secs >= 86400 * 1e3) compact = (secs / 3600 / 1e6).toFixed(1) + 'M h';
    else if (secs >= 86400 * 100) compact = (secs / 3600 / 1e3).toFixed(1) + 'k h';
    return { days: d, hrs: h, min: m, sec: s, compact };
  }

  function getClockColor(secs: number): string {
    const hrs = secs / 3600;
    if (hrs > 72) return 'text-phosphor';
    if (hrs > 24) return 'text-amber';
    return 'text-neonred';
  }

  function getZoneFromTime(secs: number) {
    const hrs = secs / 3600;
    if (hrs < 24) return 'dev_null';
    if (hrs < 720) return 'home_user';
    return 'root';
  }

  let initError = '';

  async function initUser(forceSync = false) {
    initError = '';
    const url = forceSync ? `/api/user/${userId}/init?sync=1` : `/api/user/${userId}/init`;
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include' });
      const text = await res.text();
      let data: { error?: string; time?: number } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        initError = res.ok ? 'Resposta inválida' : `Erro ${res.status}: ${text.slice(0, 100)}`;
        timeSecs = null;
        return;
      }
      if (data.error) {
        initError = data.error;
        timeSecs = null;
        return;
      }
      if (data.time != null) {
        timeSecs = data.time;
        zone = getZoneFromTime(timeSecs);
        gameZone.set(zone);
      } else {
        timeSecs = 0;
      }
    } catch (e) {
      initError = (e as Error).message || 'Erro de conexão';
      timeSecs = null;
    }
  }

  function pollTime() {
    fetch(`/api/time/${userId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.time != null) {
          const newTime = Math.max(0, d.time);
          timeSecs = newTime;
          zone = getZoneFromTime(newTime);
          gameZone.set(zone);
        }
      })
      .catch(() => {});
  }

  function connectWS() {
    if (usePolling) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? `${window.location.hostname}:8080` : window.location.host;
    const url = `${protocol}//${host}/api/ws?user=${encodeURIComponent(userId)}`;
    ws = new WebSocket(url);
    ws.onopen = () => { connected = true; };
    ws.onclose = () => {
      connected = false;
      setTimeout(connectWS, 2000);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'time_update' && typeof msg.time === 'number') {
          timeSecs = msg.time;
          zone = getZoneFromTime(timeSecs);
          gameZone.set(zone);
        }
      } catch (_) {}
    };
  }

  let unsubRefresh: (() => void) | undefined;
  let unsubVisibility: (() => void) | undefined;
  onMount(async () => {
    if (userId && userId !== 'anonymous') {
      await initUser();
      unsubRefresh = triggerTimeRefresh.subscribe((v) => {
        if (v > 0) {
          pollTime();
          initUser(true).catch(() => {});
        }
      });
      if (usePolling) {
        pollInterval = setInterval(pollTime, 2000); // Sync a cada 2s — tempo real 24x7
        const onVisibility = () => {
          if (document.visibilityState === 'visible') pollTime();
        };
        document.addEventListener('visibilitychange', onVisibility);
        unsubVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
      } else {
        connectWS();
      }
      countdownInterval = setInterval(() => {
        if (timeSecs == null || timeSecs <= 0 || (connected && !usePolling)) return;
        timeSecs--;
        if (timeSecs < 0) timeSecs = 0;
        zone = getZoneFromTime(timeSecs);
        gameZone.set(zone);
      }, 1000);
    }
  });

  onDestroy(() => {
    unsubRefresh?.();
    unsubVisibility?.();
    if (pollInterval) clearInterval(pollInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    ws?.close();
  });
</script>

<div class="space-y-6">
  {#if timeSecs != null && timeSecs > 0 && timeSecs < 86400}
    <div class="text-center py-2 px-4 rounded border-2 border-neonred bg-neonred/10 animate-pulse">
      <span class="font-mono text-neonred font-bold text-sm tracking-widest">TIME CRITICAL</span>
    </div>
  {/if}
  <div class="border border-phosphor/40 p-6 rounded-2xl bg-black/40">
    <div class="flex items-center justify-between mb-4">
      <span class="text-phosphor/70 text-sm uppercase tracking-widest">LIFE REMAINING</span>
      <span class="text-xs {connected || usePolling ? 'text-phosphor' : 'text-neonred'}">
        {usePolling ? '● 24x7' : connected ? '● LIVE' : '○ OFFLINE'}
      </span>
    </div>
    <div
      class="flex gap-2 font-mono text-4xl md:text-5xl font-bold tabular-nums {timeSecs != null ? getClockColor(timeSecs) : 'text-phosphor/50'}"
    >
      {#if timeSecs == null}
        <span class="text-phosphor/70">{initError ? 'Erro ao carregar' : 'Carregando histórico GitHub...'}</span>
      {:else if formatTime(timeSecs).compact}
        <span>{formatTime(timeSecs).compact}</span>
      {:else}
        <span>{formatTime(timeSecs).days.toString().padStart(3, '0')}</span>
        <span class="opacity-50">:</span>
        <span>{formatTime(timeSecs).hrs.toString().padStart(2, '0')}</span>
        <span class="opacity-50">:</span>
        <span>{formatTime(timeSecs).min.toString().padStart(2, '0')}</span>
        <span class="opacity-50">:</span>
        <span>{formatTime(timeSecs).sec.toString().padStart(2, '0')}</span>
      {/if}
    </div>
    {#if timeSecs != null}
      <div class="mt-2 text-phosphor/50 text-xs font-mono">
        DAYS &nbsp;&nbsp; HRS &nbsp; MIN &nbsp; SEC
      </div>
    {/if}
  </div>

  {#if initError}
    <div class="mt-3 p-4 border border-neonred/50 bg-neonred/10 text-neonred text-sm">
      {initError}
      <a href="/api/auth/github" class="block mt-3 underline font-bold">Fazer login novamente</a>
    </div>
  {:else if timeSecs != null && timeSecs <= 0}
    <div class="border-2 border-neonred p-8 text-neonred text-center rounded">
      <p class="text-3xl font-bold tracking-wider">MORTE DIGITAL</p>
      <p class="text-sm mt-3 opacity-90">O Arquivo dos Ecos — seu perfil foi petrificado.</p>
      <p class="text-xs mt-4 text-phosphor/70">Ressurreição: PR aceito em projeto +100 estrelas = +30 dias.</p>
      <a
        href="/api/auth/github"
        class="inline-block mt-6 px-6 py-3 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black font-bold"
      >
        CONTRIBUIR NO GITHUB
      </a>
    </div>
  {:else if timeSecs != null}
    <div class="text-phosphor/60 text-xs space-y-2">
      <div>
        Zona atual: <span class="text-phosphor font-bold">
          {zone === 'dev_null' ? '/dev/null' : zone === 'home_user' ? '/home/user' : '/root'}
        </span>
      </div>
      <div class="flex gap-2">
        <button
          on:click={() => initUser(true)}
          class="text-phosphor/60 hover:text-phosphor text-xs underline"
        >
          Atualizar histórico GitHub
        </button>
      </div>
    </div>
  {/if}
</div>
