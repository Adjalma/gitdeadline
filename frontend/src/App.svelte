<script lang="ts">
  import { onMount } from 'svelte';
  import GameView from './lib/GameView.svelte';

  const STORAGE_KEY = 'gitdeadline_user';

  let userId = 'anonymous';
  let authError = '';
  let loading = true;

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const userFromUrl = params.get('user');
    const err = params.get('error');
    const logout = params.get('logout');
    if (logout) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      window.history.replaceState({}, '', '/');
    }
    if (err) authError = err === 'no_github_config' ? 'GitHub OAuth não configurado.' : 'Erro ao conectar com GitHub.';

    if (userFromUrl) {
      userId = userFromUrl.toLowerCase();
      try { localStorage.setItem(STORAGE_KEY, userId); } catch (_) {}
      window.history.replaceState({}, '', '/');
    } else {
      try {
        const res = await fetch('/api/auth/status', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          userId = data.user;
          try { localStorage.setItem(STORAGE_KEY, userId); } catch (_) {}
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) userId = stored.toLowerCase();
        }
      } catch (_) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) userId = stored.toLowerCase();
      }
    }
    loading = false;
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

  {#if loading}
    <section class="flex-1 flex items-center justify-center">
      <span class="text-phosphor/60 animate-pulse">Carregando...</span>
    </section>
  {:else if userId === 'anonymous'}
    <section class="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div class="max-w-md w-full space-y-6">
        <p class="text-phosphor/90 text-center text-sm leading-relaxed">
          Entre com seu GitHub para jogar na Cidadela Vertical.
          Tempo = histórico real de contribuições (commits, PRs, issues).
          Jogo 24x7 — nunca para.
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
        <a
          href="/api/auth/status?logout=1"
          class="block w-full text-center text-phosphor/50 hover:text-phosphor text-xs underline"
        >
          Limpar sessão e fazer logout
        </a>
      </div>
    </section>
  {:else}
    <GameView {userId} />
  {/if}

  <footer class="border-t border-phosphor/20 px-6 py-3 text-center text-phosphor/50 text-xs">
    Tempo diminui em tempo real 24x7 (servidor) | Histórico GitHub | PR +72h · Issue +48h · Commit +1h
  </footer>
</main>
