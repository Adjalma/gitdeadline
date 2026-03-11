<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let userId: string;

  let timeSecs = 86400;
  let ws: WebSocket | null = null;
  let connected = false;
  let zone: 'dev_null' | 'home_user' | 'root' = 'home_user';
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  const usePolling = import.meta.env.PROD;

  function formatTime(secs: number) {
    if (secs <= 0) return { days: 0, hrs: 0, min: 0, sec: 0 };
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return { days: d, hrs: h, min: m, sec: s };
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

  async function initUser() {
    const res = await fetch(`/api/user/${userId}/init`, { method: 'POST' });
    const data = await res.json();
    if (data.time != null) {
      timeSecs = data.time;
      zone = getZoneFromTime(timeSecs);
    }
  }

  function pollTime() {
    fetch(`/api/time/${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.time != null) {
          // Só atualiza se recebeu bônus (servidor tem bem mais tempo) ou zerou no servidor
          // Evita que poll sem Redis (sempre 86400) resetar o countdown local
          if (d.time > timeSecs + 60 || d.time <= 0) {
            timeSecs = Math.max(0, d.time);
            zone = getZoneFromTime(timeSecs);
          }
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
        }
      } catch (_) {}
    };
  }

  onMount(async () => {
    if (userId && userId !== 'anonymous') {
      await initUser();
      if (usePolling) {
        pollInterval = setInterval(pollTime, 10000); // Sync a cada 10s (bônus, etc)
      } else {
        connectWS();
      }
      countdownInterval = setInterval(() => {
        if (timeSecs <= 0 || (connected && !usePolling)) return;
        timeSecs--;
        if (timeSecs < 0) timeSecs = 0;
      }, 1000);
    }
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    ws?.close();
  });
</script>

<div class="space-y-6">
  <div class="border border-phosphor/40 p-6">
    <div class="flex items-center justify-between mb-4">
      <span class="text-phosphor/70 text-sm uppercase tracking-widest">LIFE REMAINING</span>
      <span class="text-xs {connected || usePolling ? 'text-phosphor' : 'text-neonred'}">
        {usePolling ? '● SYNC' : connected ? '● LIVE' : '○ OFFLINE'}
      </span>
    </div>
    <div
      class="flex gap-2 font-mono text-4xl md:text-5xl font-bold tabular-nums {getClockColor(timeSecs)}"
    >
      <span>{formatTime(timeSecs).days.toString().padStart(3, '0')}</span>
      <span class="opacity-50">:</span>
      <span>{formatTime(timeSecs).hrs.toString().padStart(2, '0')}</span>
      <span class="opacity-50">:</span>
      <span>{formatTime(timeSecs).min.toString().padStart(2, '0')}</span>
      <span class="opacity-50">:</span>
      <span>{formatTime(timeSecs).sec.toString().padStart(2, '0')}</span>
    </div>
    <div class="mt-2 text-phosphor/50 text-xs font-mono">
      DAYS &nbsp;&nbsp; HRS &nbsp; MIN &nbsp; SEC
    </div>
  </div>

  {#if timeSecs <= 0}
    <div class="border border-neonred p-6 text-neonred text-center">
      <p class="text-xl font-bold">MORTE DIGITAL</p>
      <p class="text-sm mt-2 opacity-80">Seu tempo acabou. Contribua no GitHub para a ressurreição.</p>
    </div>
  {:else}
    <div class="text-phosphor/60 text-xs">
      Zona atual: <span class="text-phosphor font-bold">
        {zone === 'dev_null' ? '/dev/null' : zone === 'home_user' ? '/home/user' : '/root'}
      </span>
    </div>
  {/if}
</div>
