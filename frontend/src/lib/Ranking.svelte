<script lang="ts">
  interface Props {
    userId: string;
  }
  let { userId }: Props = $props();

  interface RankEntry {
    user_id: string;
    score: number;
    rank: number;
  }
  let ranking = $state<RankEntry[]>([]);

  const API_BASE = '';

  async function fetchRanking() {
    try {
      const res = await fetch(`${API_BASE}/api/ranking`);
      const data = await res.json();
      if (data.ranking) ranking = data.ranking;
    } catch (_) {}
  }

  $effect(() => {
    fetchRanking();
    const iv = setInterval(fetchRanking, 10000);
    return () => clearInterval(iv);
  });

  function formatScore(secs: number): string {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h`;
    return `${Math.floor(secs % 3600 / 60)}m`;
  }
</script>

<div class="mt-10 border border-phosphor/30 p-6">
  <h2 class="text-phosphor/80 text-sm uppercase tracking-widest mb-4">RANKING DE LONGEVIDADE</h2>
  <div class="space-y-1 font-mono text-sm">
    {#each ranking as entry (entry.user_id)}
      <div
        class="flex items-center justify-between py-1 px-2 {entry.user_id === userId ? 'bg-phosphor/10 border-l-2 border-phosphor' : ''}"
      >
        <span class="text-phosphor/70 w-8">#{entry.rank}</span>
        <span class="flex-1 truncate {entry.user_id === userId ? 'text-phosphor font-bold' : 'text-phosphor/90'}">
          {entry.user_id}
        </span>
        <span class="text-amber/90 tabular-nums">{formatScore(entry.score)}</span>
      </div>
    {:else}
      <p class="text-phosphor/50 text-sm py-4">Nenhum jogador no ranking.</p>
    {/each}
  </div>
</div>
