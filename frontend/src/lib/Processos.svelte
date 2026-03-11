<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let userId: string;

  interface RankEntry {
    user_id: string;
    score: number;
    rank: number;
  }
  let ranking: RankEntry[] = [];
  let donateTo = '';
  let donating = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  async function fetchRanking() {
    try {
      const res = await fetch('/api/ranking');
      const data = await res.json();
      if (data.ranking) ranking = data.ranking;
    } catch (_) {}
  }

  function formatTime(secs: number): string {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function glowColor(score: number): string {
    const hrs = score / 3600;
    if (hrs > 720) return 'ring-2 ring-amber/50';
    if (hrs > 72) return 'ring-2 ring-phosphor/50';
    return 'ring-2 ring-neonred/50';
  }

  async function doar(para: string, horas: number) {
    if (!para || para === userId) return;
    donating = true;
    try {
      const res = await fetch(`/api/user/${userId}/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: para, hours: horas }),
      });
      const data = await res.json();
      if (data.ok) {
        donateTo = '';
        fetchRanking();
      } else {
        alert(data.error || 'Erro ao doar');
      }
    } catch (_) {
      alert('Erro ao doar tempo');
    }
    donating = false;
  }

  onMount(() => {
    fetchRanking();
    interval = setInterval(fetchRanking, 10000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

<div class="space-y-3">
  <div class="space-y-2 mt-1">
    {#each ranking as entry (entry.user_id)}
      <div
        class="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-phosphor/20 {entry.user_id === userId ? 'bg-phosphor/10 ring-1 ring-phosphor/40' : 'bg-black/40'} hover:border-phosphor/40 hover:shadow-[0_0_20px_rgba(57,255,20,0.1)] transition-all"
      >
        <!-- Avatar holográfico -->
        <div class="relative w-11 h-11 rounded-full flex items-center justify-center font-mono text-sm font-bold {glowColor(entry.score)}"
          style="background: linear-gradient(135deg, rgba(57,255,20,0.25), rgba(57,255,20,0.05)); box-shadow: 0 0 15px rgba(57,255,20,0.3);"
        >
          <span class="text-phosphor/90">{entry.user_id.slice(0, 2).toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <span class="font-mono {entry.user_id === userId ? 'text-phosphor font-bold' : 'text-phosphor/90'} truncate block">
            {entry.user_id}
          </span>
          <span class="text-amber/80 text-xs font-mono tabular-nums">
            ● {formatTime(entry.score)} — #{entry.rank}
          </span>
        </div>
        {#if entry.user_id !== userId && entry.rank <= 10}
          {#if donateTo === entry.user_id}
            <div class="flex gap-1">
              <button
                on:click={() => doar(entry.user_id, 1)}
                disabled={donating}
                class="px-2 py-1 text-xs border border-amber/50 text-amber disabled:opacity-50"
              >1h</button>
              <button
                on:click={() => doar(entry.user_id, 6)}
                disabled={donating}
                class="px-2 py-1 text-xs border border-amber/50 text-amber disabled:opacity-50"
              >6h</button>
              <button
                on:click={() => { donateTo = ''; }}
                class="px-2 py-1 text-xs border border-phosphor/50 text-phosphor/70"
              >✕</button>
            </div>
          {:else}
            <button
              on:click={() => { donateTo = entry.user_id; }}
              class="px-2 py-1 text-xs border border-phosphor/50 text-phosphor/80 hover:bg-phosphor/10"
            >
              Doar tempo
            </button>
          {/if}
        {/if}
      </div>
    {:else}
      <p class="text-phosphor/50 text-sm py-4">Nenhum processo na zona.</p>
    {/each}
  </div>
</div>
