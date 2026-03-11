<script lang="ts">
  /**
   * Globo 3D — GIT DEADLINE
   * Escala para 100k+ usuários via clustering. Cada cluster = agregação de jogadores.
   */
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
  interface Cluster {
    lat: number;
    lng: number;
    count: number;
    zone: Zone;
    hasOnline: boolean;
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
  let pointsMesh: THREE.Points | null = null;
  let meMarker: THREE.Mesh | null = null;
  const MAX_FETCH = 100000;
  const MAX_CLUSTERS = 2500;

  const COLORS = { root: 0xffbf00, home_user: 0x39ff14, dev_null: 0xff073a };

  function latLngFromRank(rank: number, total: number): [number, number] {
    const i = rank - 1;
    const phi = Math.acos(-1 + (2 * i) / Math.max(1, total));
    const theta = Math.sqrt(total * Math.PI) * phi;
    const lat = 90 - (phi * 180) / Math.PI;
    const lng = (theta * 180) / Math.PI;
    return [lat, ((lng % 360) + 360) % 360];
  }

  function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = (lng * Math.PI) / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }

  /** Agrupa usuários em clusters para escala (até 100k). Tamanho do cluster = f(count). */
  function clusterUsers(userList: MapUser[]): Cluster[] {
    if (userList.length === 0) return [];
    const n = userList.length;
    const targetCells = Math.min(MAX_CLUSTERS, Math.max(100, Math.ceil(Math.sqrt(n) * 1.2)));
    const gridSize = Math.ceil(Math.sqrt(targetCells));
    const cellLat = 180 / gridSize;
    const cellLng = 360 / gridSize;
    const buckets = new Map<
      string,
      { lats: number[]; lngs: number[]; zones: Record<Zone, number>; online: number }
    >();
    for (const u of userList) {
      const [lat, lng] = latLngFromRank(u.rank, n);
      const ky = Math.min(gridSize - 1, Math.floor((lat + 90) / cellLat));
      const kx = Math.floor(((lng + 360) % 360) / cellLng) % Math.ceil(360 / cellLng);
      const key = `${ky}_${kx}`;
      if (!buckets.has(key))
        buckets.set(key, { lats: [], lngs: [], zones: { dev_null: 0, home_user: 0, root: 0 }, online: 0 });
      const b = buckets.get(key)!;
      b.lats.push(lat);
      b.lngs.push(lng);
      b.zones[u.zone]++;
      if (u.online) b.online++;
    }
    const clusters: Cluster[] = [];
    for (const [, v] of buckets) {
      if (v.lats.length === 0) continue;
      const entries = Object.entries(v.zones) as [Zone, number][];
      const dominant = entries.sort((a, b) => b[1] - a[1])[0][0];
      clusters.push({
        lat: v.lats.reduce((a, x) => a + x, 0) / v.lats.length,
        lng: v.lngs.reduce((a, x) => a + x, 0) / v.lngs.length,
        count: v.lats.length,
        zone: dominant,
        hasOnline: v.online > 0,
      });
    }
    return clusters;
  }

  function formatHours(h: number): string {
    if (h >= 1e9) return (h / 1e9).toFixed(1) + 'B';
    if (h >= 1e6) return (h / 1e6).toFixed(1) + 'M';
    if (h >= 1e3) return (h / 1e3).toFixed(1) + 'k';
    return String(Math.floor(h));
  }

  async function fetchMap(includeDebug = false) {
    try {
      const cacheBust = `&_=${Date.now()}`;
      const url = `/api/ranking?map=1&limit=${MAX_FETCH}${userId ? `&ping=${encodeURIComponent(userId)}` : ''}${includeDebug ? '&debug=1' : ''}${cacheBust}`;
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      users = data.users ?? [];
      onlineCount = data.online_count || 0;
      syncError = data?.error || '';
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

  function updateScene() {
    if (!scene) return;
    if (pointsMesh) {
      scene.remove(pointsMesh);
      pointsMesh.geometry.dispose();
      (pointsMesh.material as THREE.Material).dispose();
    }
    pointsMesh = null;
    const clusters = clusterUsers(users);
    if (clusters.length === 0) return;
    const n = clusters.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const totalUsers = users.length;
    const maxCount = Math.max(1, ...clusters.map((c) => c.count));
    clusters.forEach((cl, i) => {
      const v = latLngToVector3(cl.lat, cl.lng, 2.2);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      const col = new THREE.Color(COLORS[cl.zone]);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      const sizeBase = 0.05 + 0.25 * Math.log10(1 + cl.count) / Math.log10(1 + maxCount);
      sizes[i] = cl.hasOnline ? sizeBase * 1.3 : sizeBase;
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
    const baseSize = totalUsers > 50000 ? 0.06 : totalUsers > 10000 ? 0.08 : 0.1;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        size: { value: baseSize },
        scale: { value: 1 },
      },
      vertexShader: `
        attribute float pointSize;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * size * (scale / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.5, 0.8, d);
          gl_FragColor = vec4(vColor, a * 0.92);
        }
      `,
    });
    pointsMesh = new THREE.Points(geom, mat);
    scene.add(pointsMesh);

    // Marcador "VOCÊ" — destaque para o usuário atual
    if (meMarker) {
      scene.remove(meMarker);
      meMarker.geometry.dispose();
      (meMarker.material as THREE.Material).dispose();
      meMarker = null;
    }
    if (userId) {
      const me = users.find((u) => u.user_id.toLowerCase() === userId.toLowerCase());
      if (me) {
        const [lat, lng] = latLngFromRank(me.rank, users.length);
        const pos = latLngToVector3(lat, lng, 2.28);
        const sphereGeom = new THREE.SphereGeometry(0.12, 12, 8);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: 0x39ff14,
          transparent: true,
          opacity: 0.95,
        });
        meMarker = new THREE.Mesh(sphereGeom, sphereMat);
        meMarker.position.copy(pos);
        scene.add(meMarker);
      }
    }
  }

  function initThree() {
    if (!containerEl) return;
    const w = containerEl.clientWidth;
    const h = Math.max(320, containerEl.clientHeight);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.Fog(0x050508, 8, 25);
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerEl.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.5;
    controls.maxDistance = 15;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    const ambient = new THREE.AmbientLight(0x111122);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0x39ff14, 0.5);
    dir.position.set(5, 5, 5);
    scene.add(dir);
    const globeGeom = new THREE.SphereGeometry(2, 64, 48);
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x0a1628,
      emissive: 0x051018,
      transparent: true,
      opacity: 0.85,
      wireframe: false,
    });
    const globe = new THREE.Mesh(globeGeom, globeMat);
    scene.add(globe);
    const wireGeom = new THREE.SphereGeometry(2.02, 32, 16);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wire = new THREE.Mesh(wireGeom, wireMat);
    scene.add(wire);
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
    const h = Math.max(320, containerEl.clientHeight);
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
    fetchMap().then(async () => {
      initThree();
      animate();
      if (users.length === 0 && userId) {
        try {
          const r = await fetch(`/api/user/${userId}/init?sync=1`, { method: 'POST', credentials: 'include' });
          const data = await r.json().catch(() => ({}));
          if (r.ok) {
            await new Promise((x) => setTimeout(x, 800));
            await fetchMap(true);
            if (scene) updateScene();
          } else {
            syncError = data?.error || `Erro ${r.status}`;
          }
        } catch (e) {
          syncError = (e as Error)?.message || 'Erro ao sincronizar';
        }
      }
      window.addEventListener('resize', onResize);
      iv = setInterval(() => fetchMap().then(() => updateScene()), 15000);
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
      pointsMesh?.geometry?.dispose();
      (pointsMesh?.material as THREE.Material)?.dispose();
      meMarker?.geometry?.dispose();
      (meMarker?.material as THREE.Material)?.dispose();
    };
  });

  $: if (!loading && users.length > 0 && scene) updateScene();
</script>

<div class="map-punk border-2 border-phosphor/40 rounded-lg overflow-hidden bg-[#050508] relative">
  <div class="flex items-center justify-between px-4 py-3 border-b-2 border-phosphor/30 bg-black/80">
    <span class="text-phosphor font-mono text-sm font-bold uppercase tracking-[0.2em]">
      GLOBO 3D — <span class="text-amber">GIT DEADLINE</span>
    </span>
    <span class="text-phosphor/70 text-xs font-mono tabular-nums">
      <span class="text-phosphor">{onlineCount}</span> online · <span class="text-phosphor">{users.length.toLocaleString()}</span> jogadores
    </span>
  </div>
  <div class="relative min-h-[360px]">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center z-10">
        <span class="text-phosphor/50 font-mono text-sm animate-pulse">Carregando...</span>
      </div>
    {/if}
    <div bind:this={containerEl} class="w-full h-[360px] min-h-[360px]"></div>
    {#if !loading && users.length === 0}
      <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-6 max-w-md mx-auto">
        <p class="text-amber font-mono font-bold text-center text-base">Mapa vazio</p>
        <p class="text-phosphor/80 text-xs mt-3 text-center">
          Clique em <strong>Re-sincronizar</strong> para gravar seu tempo no ranking.
        </p>
        {#if syncError}
          <div class="mt-4 p-3 rounded border border-neonred/50 bg-neonred/10 text-neonred text-[11px] font-mono">{syncError}</div>
        {:else if debugInfo}
          <div class="mt-4 p-3 rounded border border-phosphor/30 bg-black/40 text-phosphor/80 text-[11px] font-mono">
            Redis: {debugInfo.redis_ok ? '✓' : '✗'} · Ranking: {debugInfo.ranking_count ?? '?'}
          </div>
        {/if}
        <div class="mt-4 flex gap-2">
          <button on:click={() => fetchMap(true)} class="px-3 py-2 border border-phosphor/50 text-phosphor/80 hover:text-phosphor text-xs font-mono">Diagnóstico</button>
          <button on:click={syncAndRefresh} class="px-5 py-2.5 border-2 border-phosphor text-phosphor hover:bg-phosphor hover:text-black text-sm font-mono font-bold">Re-sincronizar</button>
        </div>
      </div>
    {/if}
    <div class="absolute bottom-2 left-2 right-2 flex justify-between items-center text-phosphor/50 text-[10px] font-mono">
      <span>Arraste · Scroll zoom · Pontos maiores = mais jogadores</span>
      <span class="flex gap-3">
        {#if userId}
          <span><span class="text-phosphor">◆</span> Você</span>
        {/if}
        <span><span class="text-amber">●</span> /root</span>
        <span><span class="text-phosphor">●</span> /home/user</span>
        <span><span class="text-neonred">●</span> /dev/null</span>
      </span>
    </div>
  </div>
  {#if onlineCount > 0}
    <div class="px-4 py-3 border-t border-phosphor/20">
      <span class="text-phosphor/80 text-[10px] font-mono uppercase">Conectados:</span>
      <div class="flex flex-wrap gap-2 mt-2">
        {#each users.filter((u) => u.online).slice(0, 12) as u}
          <span class="px-2 py-1 rounded border text-xs font-mono {userId && u.user_id === userId.toLowerCase() ? 'border-phosphor bg-phosphor/15 text-phosphor' : 'border-phosphor/30 text-phosphor/80'}">
            {u.user_id} <span class="text-phosphor/50">({formatHours(u.hours)}h)</span>
          </span>
        {/each}
        {#if onlineCount > 12}
          <span class="text-phosphor/50 text-xs">+{onlineCount - 12} mais</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .map-punk { box-shadow: 0 0 30px rgba(57, 255, 20, 0.1); }
</style>
