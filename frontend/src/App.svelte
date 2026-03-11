<script lang="ts">
  import { onMount } from 'svelte';
  import GameView from './lib/GameView.svelte';

  let userId = 'anonymous';
  let authError = '';

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const userFromUrl = params.get('user');
    if (userFromUrl) {
      userId = userFromUrl;
      window.history.replaceState({}, '', '/');
    }
    const err = params.get('error');
    if (err) authError = err === 'no_github_config' ? 'GitHub OAuth não configurado.' : 'Erro ao conectar com GitHub.';
  });
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
          Entre com seu GitHub para jogar na Cidadela Vertical.
          O relógio começa em 24h. Commits, PRs e Issues concedem tempo.
        </p>
        {#if authError}
          <p class="text-neonred text-sm text-center">{authError}</p>
        {/if}
        <a
          href="/api/auth/github"
          class="block w-full text-center px-6 py-3 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black font-bold transition-colors"
        >
          ENTRAR COM GITHUB
        </a>
      </div>
    </section>
  {:else}
    <GameView {userId} />
  {/if}

  <footer class="border-t border-phosphor/20 px-6 py-3 text-center text-phosphor/50 text-xs">
    PR Merged +72h | Issue +48h | Commit +1h (anti-spam 1h) | Tempo decrementa 1s/s
  </footer>
</main>
