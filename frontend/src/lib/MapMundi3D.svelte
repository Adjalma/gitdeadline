<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { triggerMapRefresh, triggerTimeRefresh } from './stores.js';

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
  let debugInfo: { redis_ok?: boolean; ranking_count?: number } | null = null;
  let syncError = '';
  let containerEl: HTMLDivElement;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let frameId: number;
  let playerMeshes: THREE.Group[] = [];

  const COLORS = { root: 0xffbf00, home_user: 0x39ff14, dev_null: 0xff073a };
  const zoneLabels: Record<Zone, string> = {
    root: '/root',
    home_user: '/home/user',
    dev_null: '/dev/null',
  };

  function buildingHeight(hours: number): number {
    if (hours <= 0) return 0.2;
    const log = Math.log10(hours + 1);
    return Math.min(2.5, Math.max(0.3, log * 0.4));
  }

  function formatHours(h: number): string {
    if (h >= 1e9) return (h / 1e9).toFixed(1) + 'B';
    if (h >= 1e6) return (h / 1e6).toFixed(1) + 'M';
    if (h >= 1e3) return (h / 1e3).toFixed(1) + 'k';
    return String(Math.floor(h));
  }

  async function fetchMap(includeDebug = false) {
    try {
      const url = `/api/ranking?map=1&limit=200${userId ? `&ping=${encodeURIComponent(userId)}` : ''}${includeDebug ? '&debug=1' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      users = data.users ?? [];
      onlineCount = data.online_count || 0;
      if (includeDebug && data.debug) debugInfo = data.debug;
    } catch (_) {
      users = [];
    } finally {
      loading = false;
    }
  }

  async function syncAndRefresh() {
    if (!userId) return;
    syncError = '';
    try {
      const res = await fetch(`/api/user/${userId}/init?sync=1`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        triggerTimeRefresh.update((n) => n + 1);
        triggerMapRefresh.update((n) => n + 1);
      } else {
        syncError = data?.error || `Erro ${res.status}`;
      }
      await fetchMap(true);
      if (scene) updateScene();
    } catch (e) {
      syncError = (e as Error)?.message || 'Erro ao sincronizar';
    }
  }

  function createTower(
    zone: Zone,
    height: number,
    isOnline: boolean,
    isMe: boolean,
    x: number,
    z: number,
  ): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(COLORS[zone]);
    const geom = new THREE.CylinderGeometry(0.15, 0.2, height, 6);
    const mat = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: isOnline ? 0.4 : 0.1,
      transparent: true,
      opacity: isOnline ? 1 : 0.6,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    group.add(mesh);
    group.position.set(x, 0, z);
    group.userData = { zone };
    if (isMe) {
      const ring = new THREE.RingGeometry(0.3, 0.4, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ring, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.02;
      group.add(ringMesh);
    }
    return group;
  }

  function zoneY(zone: Zone): number {
    if (zone === 'root') return 3.5;
    if (zone === 'home_user') return 1.2;
    return -1.2;
  }

  function updateScene() {
    if (!scene) return;
    playerMeshes.forEach((g) => {
      scene.remove(g);
      g.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry?.dispose();
          (c.material as THREE.Material)?.dispose();
        }
      });
    });
    playerMeshes = [];
    const byZone: Record<Zone, MapUser[]> = {
      root: [],
      home_user: [],
      dev_null: [],
    };
    users.forEach((u) => byZone[u.zone].push(u));
    const spread = 2.5;
    let idx = 0;
    users.forEach((u) => {
      const yBase = zoneY(u.zone);
      const col = Math.floor(idx / 4);
      const row = idx % 4;
      const x = (col - 2) * 0.8 + (Math.random() - 0.5) * 0.3;
      const z = (row - 1.5) * 0.8 + (Math.random() - 0.5) * 0.3;
      const h = buildingHeight(u.hours);
      const tower = createTower(
        u.zone,
        h,
        u.online,
        !!(userId && u.user_id === userId.toLowerCase()),
        x,
        z,
      );
      tower.position.y = yBase;
      scene.add(tower);
      playerMeshes.push(tower);
      idx++;
    });
  }

  function initThree() {
    if (!containerEl) return;
    const w = containerEl.clientWidth;
    const h = Math.max(280, containerEl.clientHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08080c);
    scene.fog = new THREE.Fog(0x08080c, 8, 25);
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(6, 2, 8);
    camera.lookAt(0, 1, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2 + 0.2;
    const ambient = new THREE.AmbientLight(0x222244);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0x39ff14, 0.6);
    key.position.set(5, 10, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.PointLight(0xffbf00, 0.3);
    fill.position.set(-5, 5, -5);
    scene.add(fill);
    const back = new THREE.PointLight(0xff073a, 0.2);
    back.position.set(0, -3, -5);
    scene.add(back);
    const floorGeom = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x0a0a12,
      transparent: true,
      opacity: 0.9,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    scene.add(floor);
    const tierHeights = [
      { zone: 'root' as Zone, y: 3.5, color: 0xffbf00 },
      { zone: 'home_user' as Zone, y: 1.2, color: 0x39ff14 },
      { zone: 'dev_null' as Zone, y: -1.2, color: 0xff073a },
    ];
    tierHeights.forEach((t, i) => {
      const h = 0.15;
      const box = new THREE.BoxGeometry(12, h, 8);
      const mat = new THREE.MeshPhongMaterial({
        color: t.color,
        emissive: t.color,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.25,
      });
      const mesh = new THREE.Mesh(box, mat);
      mesh.position.y = t.y;
      scene.add(mesh);
    });
    updateScene();
  }

  function animate() {
    frameId = requestAnimationFrame(animate);
    controls?.update();
    renderer?.render(scene, camera);
  }

  function onResize() {
    if (!containerEl || !camera || !renderer) return;
    const w = containerEl.clientWidth;
    const h = Math.max(280, containerEl.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  let unsubMap: (() => void) | undefined;
  onMount(() => {
    let iv: ReturnType<typeof setInterval>;
    unsubMap = triggerMapRefresh.subscribe((v) => {
      if (v > 0) fetchMap().then(() => updateScene());
    });
    fetchMap().then(() => {
      initThree();
      animate();
      window.addEventListener('resize', onResize);
      iv = setInterval(() => {
        fetchMap().then(() => updateScene());
      }, 15000);
    });
    return () => {
      unsubMap?.();
      if (iv) clearInterval(iv);
      window.removeEventListener('resize', onResize);
      if (frameId) cancelAnimationFrame(frameId);
      if (renderer?.domElement && containerEl?.contains(renderer.domElement)) {
        containerEl.removeChild(renderer.domElement);
      }
      renderer?.dispose();
      playerMeshes.forEach((g) => {
        g.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry?.dispose();
            (c.material as THREE.Material)?.dispose();
          }
        });
      });
    };
  });

  $: if (!loading && users.length > 0 && scene) {
    updateScene();
  }
</script>

<div class="map-punk border-2 border-phosphor/40 rounded-lg overflow-hidden bg-[#08080c] relative">
  <div class="flex items-center justify-between px-4 py-3 border-b-2 border-phosphor/30 bg-black/80">
    <span class="text-phosphor font-mono text-sm font-bold uppercase tracking-[0.2em]">
      MAPA MUNDI 3D — <span class="text-amber">GIT DEADLINE</span>
    </span>
    <span class="text-phosphor/70 text-xs font-mono tabular-nums">
      <span class="text-phosphor">{onlineCount}</span> online · <span class="text-phosphor">{users.length}</span> jogadores
    </span>
  </div>
  <div class="relative min-h-[320px]">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center z-10">
        <span class="text-phosphor/50 font-mono text-sm animate-pulse">Carregando...</span>
      </div>
    {/if}
    <div bind:this={containerEl} class="w-full h-[320px] min-h-[320px]"></div>
    {#if !loading && users.length === 0}
      <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-6 max-w-md mx-auto">
        <p class="text-amber font-mono font-bold text-center text-base">Mapa vazio</p>
        <p class="text-phosphor/80 text-xs mt-3 text-center leading-relaxed">
          Clique em <strong>Re-sincronizar</strong> para gravar seu tempo no ranking. Se já fez isso e nada muda, veja o diagnóstico.
        </p>
        {#if syncError}
          <div class="mt-4 p-3 rounded border border-neonred/50 bg-neonred/10 text-neonred text-[11px] font-mono">
            {syncError}
          </div>
        {:else if debugInfo}
          <div class="mt-4 p-3 rounded border border-phosphor/30 bg-black/40 text-phosphor/80 text-[11px] font-mono">
            Redis: {debugInfo.redis_ok ? '✓ OK' : '✗ não configurado'}<br>
            Jogadores no ranking: {debugInfo.ranking_count ?? '?'}
          </div>
        {/if}
        <div class="mt-4 flex gap-2 flex-wrap justify-center">
          <button
            on:click={() => fetchMap(true)}
            class="px-3 py-2 border border-phosphor/50 text-phosphor/80 hover:text-phosphor text-xs font-mono"
          >
            Diagnóstico
          </button>
          <button
            on:click={syncAndRefresh}
            class="px-5 py-2.5 border-2 border-phosphor text-phosphor hover:bg-phosphor hover:text-black text-sm font-mono font-bold transition-all"
          >
            Re-sincronizar
          </button>
        </div>
      </div>
    {/if}
    <div class="absolute bottom-2 left-2 right-2 flex justify-between items-center text-phosphor/50 text-[10px] font-mono">
      <span>Arraste para girar · Scroll para zoom</span>
      <span class="flex gap-3">
        <span><span class="text-amber">■</span> /root</span>
        <span><span class="text-phosphor">■</span> /home/user</span>
        <span><span class="text-neonred">■</span> /dev/null</span>
      </span>
    </div>
  </div>
  {#if onlineCount > 0}
    <div class="px-4 py-3 border-t border-phosphor/20">
      <span class="text-phosphor/80 text-[10px] font-mono uppercase">Conectados:</span>
      <div class="flex flex-wrap gap-2 mt-2">
        {#each users.filter((u) => u.online) as u}
          <span
            class="px-2 py-1 rounded border text-xs font-mono {userId && u.user_id === userId.toLowerCase() ? 'border-phosphor bg-phosphor/15 text-phosphor' : 'border-phosphor/30 text-phosphor/80'}"
          >
            {u.user_id} <span class="text-phosphor/50">({formatHours(u.hours)}h)</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .map-punk {
    box-shadow: 0 0 30px rgba(57, 255, 20, 0.15);
  }
</style>
