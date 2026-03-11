<script lang="ts">
  import LifeClock from './lib/LifeClock.svelte';
  import Ranking from './lib/Ranking.svelte';

  let userName = 'dev';
  let userId = 'anonymous';

  function handleStart() {
    userId = userName.trim() || 'anonymous';
  }
</script>

<main class="min-h-screen bg-black flex flex-col">
  <header class="border-b border-phosphor/30 px-6 py-4">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <h1 class="text-xl font-bold tracking-wider text-phosphor">
        GITdeadline<span class="text-black bg-phosphor px-1">_</span>
      </h1>
      <span class="text-amber/80 text-sm">SEU CÓDIGO É SEU TEMPO</span>
    </div>
  </header>

  {#if userId === 'anonymous'}
    <section class="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div class="max-w-md w-full space-y-6">
        <p class="text-phosphor/90 text-center text-sm leading-relaxed">
          Digite seu username do GitHub para entrar na Cidadela Vertical.
          O relógio começa em 24h. Commits, PRs e Issues concedem tempo.
        </p>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={userName}
            placeholder="username"
            class="flex-1 bg-black border border-phosphor/50 px-4 py-3 text-phosphor placeholder-phosphor/40 focus:outline-none focus:border-phosphor font-mono"
            on:keydown={(e) => e.key === 'Enter' && handleStart()}
          />
          <button
            on:click={handleStart}
            class="px-6 py-3 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black font-bold transition-colors"
          >
            ENTRAR
          </button>
        </div>
      </div>
    </section>
  {:else}
    <section class="flex-1 p-6 max-w-4xl mx-auto w-full">
      <LifeClock {userId} />
      <div class="mt-4 flex gap-2">
        <button
          on:click={async () => {
            await fetch(`/api/user/${userId}/bonus?event=commit`, { method: 'POST' });
          }}
          class="px-4 py-2 border border-amber/50 text-amber/90 hover:bg-amber/10 text-sm"
        >
          +1h (commit)
        </button>
        <button
          on:click={async () => {
            await fetch(`/api/user/${userId}/bonus?event=pr_merged`, { method: 'POST' });
          }}
          class="px-4 py-2 border border-phosphor/50 text-phosphor hover:bg-phosphor/10 text-sm"
        >
          +72h (PR)
        </button>
      </div>
      <Ranking {userId} />
    </section>
  {/if}

  <footer class="border-t border-phosphor/20 px-6 py-3 text-center text-phosphor/50 text-xs">
    PR Merged +72h | Issue +48h | Commit +1h (anti-spam 1h) | Tempo decrementa 1s/s
  </footer>
</main>
