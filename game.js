(async function () {
  "use strict";

  // =========================================================================
  //  Kalum's World — Realistic Nordic Adventure
  //  Smooth procedural terrain, pine forests, snowy peaks, frost creatures.
  // =========================================================================

  const API_ROOT = location.protocol.startsWith("http")
    ? `${location.origin}/api`
    : "http://localhost:3100/api";

  const state = {
    backendOnline: false,
    worldSeed: Math.floor(Date.now() / 86400000),
    dailyChallenge: "Gather 5 runestones and survive the wilds.",
    playerName: "KalumHero",
    autosaveTimer: 0,
    saveInFlight: false,
    startInProgress: false,
    profileBest: 0,
  };

  const ui = {
    hud: document.getElementById("hud"),
    start: document.getElementById("start"),
    playBtn: document.getElementById("playbtn"),
    nameInput: document.getElementById("nameInput"),
    playerTag: document.getElementById("playerTag"),
    px: document.getElementById("px"),
    py: document.getElementById("py"),
    pz: document.getElementById("pz"),
    dailyText: document.getElementById("dailyText"),
    questProgress: document.getElementById("questProgress"),
    backendText: document.getElementById("backendText"),
    backendDot: document.getElementById("backendDot"),
    healthFill: document.getElementById("healthFill"),
    healthText: document.getElementById("healthText"),
    energyFill: document.getElementById("energyFill"),
    energyText: document.getElementById("energyText"),
    xpFill: document.getElementById("xpFill"),
    xpText: document.getElementById("xpText"),
    levelText: document.getElementById("levelText"),
    coinsText: document.getElementById("coinsText"),
    coresText: document.getElementById("coresText"),
    scoreText: document.getElementById("scoreText"),
    hint: document.getElementById("hint"),
    saveBtn: document.getElementById("saveBtn"),
    musicBtn: document.getElementById("musicBtn"),
    boardBtn: document.getElementById("boardBtn"),
    board: document.getElementById("board"),
    boardList: document.getElementById("boardList"),
    bossBar: document.getElementById("bossBar"),
    bossName: document.getElementById("bossName"),
    bossFill: document.getElementById("bossFill"),
    cross: document.getElementById("cross"),
    modeBadge: document.getElementById("modeBadge"),
    vignette: document.getElementById("vignette"),
    toast: document.getElementById("toast"),
    touch: document.getElementById("touch"),
    joy: document.getElementById("joy"),
    joyKnob: document.getElementById("joyKnob"),
    btnSprint: document.getElementById("btnSprint"),
    btnJump: document.getElementById("btnJump"),
    btnAttack: document.getElementById("btnAttack"),
  };

  // ---------------------------------------------------------------- renderer
  const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  const canvas = document.getElementById("c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbdd4e6, 0.0085);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 900);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x44505a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1d8, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.AmbientLight(0xb9cfe0, 0.25);
  scene.add(ambient);

  // ---------------------------------------------------------------- sky dome
  const skyUniforms = {
    top: { value: new THREE.Color(0x2f6ea8) },
    bottom: { value: new THREE.Color(0xcfe6f5) },
    offset: { value: 40 },
    exponent: { value: 0.7 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader:
        "varying vec3 vP; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vP = wp.xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform float offset; uniform float exponent; void main(){ float h = normalize(vP + vec3(0.0, offset, 0.0)).y; float t = pow(max(h,0.0), exponent); gl_FragColor = vec4(mix(bottom, top, clamp(t,0.0,1.0)), 1.0); }",
    })
  );
  sky.frustumCulled = false;
  scene.add(sky);

  // sun + moon discs
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(9, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false })
  );
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(6, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })
  );
  scene.add(sunDisc, moonDisc);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const starArr = [];
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 350 + Math.random() * 180;
    const y = 80 + Math.random() * 220;
    starArr.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starArr, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, depthWrite: false, fog: false })
  );
  scene.add(stars);

  // =========================================================================
  //  NOISE / TERRAIN
  // =========================================================================
  const WORLD = 360;
  const HALF = WORLD / 2;
  const SEG = 220;
  const WATER_LEVEL = 5.5;
  const SNOW_LEVEL = 30;

  let seed = state.worldSeed >>> 0;

  function hash2(ix, iz) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function valueNoise(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const n00 = hash2(x0, z0);
    const n10 = hash2(x0 + 1, z0);
    const n01 = hash2(x0, z0 + 1);
    const n11 = hash2(x0 + 1, z0 + 1);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return nx0 + (nx1 - nx0) * v;
  }

  function fbm(x, z, octaves) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * valueNoise(x * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  // terrain height in world units
  function terrainHeight(x, z) {
    const continent = fbm(x * 0.0055, z * 0.0055, 4); // big landmass shape 0..1
    const hills = fbm(x * 0.022 + 100, z * 0.022 + 100, 3);
    const detail = fbm(x * 0.08 + 50, z * 0.08 + 50, 2);
    // ridged mountains from continent
    const ridge = 1 - Math.abs(continent * 2 - 1);
    let h = continent * 20 + ridge * ridge * 26 + hills * 7 + detail * 2.2;
    // gentle bowl so the centre is walkable lowland and edges rise
    const edge = Math.min(1, (Math.hypot(x, z) / HALF));
    h += edge * edge * 10;
    return h - 3;
  }

  function terrainNormalY(x, z) {
    const e = 1.2;
    const hL = terrainHeight(x - e, z);
    const hR = terrainHeight(x + e, z);
    const hD = terrainHeight(x, z - e);
    const hU = terrainHeight(x, z + e);
    const nx = hL - hR;
    const nz = hD - hU;
    const ny = 2 * e;
    const len = Math.hypot(nx, ny, nz) || 1;
    return ny / len; // 1 = flat, smaller = steeper
  }

  const COL_SNOW = new THREE.Color(0xf3f8ff);
  const COL_ROCK = new THREE.Color(0x6f7780);
  const COL_ROCK_DK = new THREE.Color(0x55606b);
  const COL_GRASS = new THREE.Color(0x4f7a43);
  const COL_GRASS_DRY = new THREE.Color(0x6f8a4a);
  const COL_SAND = new THREE.Color(0xccbf93);
  const COL_DIRT = new THREE.Color(0x6b5238);
  const _c = new THREE.Color();

  let terrainMesh = null;

  function buildTerrain() {
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const slope = terrainNormalY(x, z); // 1 flat .. 0 vertical
      // choose base color by height + slope
      if (h > SNOW_LEVEL + valueNoise(x * 0.3, z * 0.3) * 3) {
        _c.copy(COL_SNOW);
      } else if (slope < 0.74) {
        _c.copy(slope < 0.6 ? COL_ROCK_DK : COL_ROCK);
      } else if (h < WATER_LEVEL + 1.2) {
        _c.copy(COL_SAND);
      } else {
        const dry = valueNoise(x * 0.05 + 9, z * 0.05 + 9);
        _c.copy(COL_GRASS).lerp(COL_GRASS_DRY, dry * 0.6);
        _c.lerp(COL_DIRT, Math.max(0, (0.82 - slope) * 1.5));
      }
      // subtle per-vertex variation
      const n = (valueNoise(x * 0.6, z * 0.6) - 0.5) * 0.08;
      _c.offsetHSL(0, 0, n);
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.0 });
    if (terrainMesh) {
      scene.remove(terrainMesh);
      terrainMesh.geometry.dispose();
    }
    terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = false;
    scene.add(terrainMesh);
  }

  // ---------------------------------------------------------------- water
  let waterMesh = null;
  function buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD, WORLD, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f6f9e,
      transparent: true,
      opacity: 0.82,
      roughness: 0.18,
      metalness: 0.4,
    });
    waterMesh = new THREE.Mesh(geo, mat);
    waterMesh.position.y = WATER_LEVEL;
    scene.add(waterMesh);
  }

  // =========================================================================
  //  VEGETATION (instanced)
  // =========================================================================
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();

  function scatter(count, test, place) {
    let made = 0;
    let attempts = 0;
    while (made < count && attempts < count * 12) {
      attempts++;
      const x = (Math.random() - 0.5) * (WORLD - 16);
      const z = (Math.random() - 0.5) * (WORLD - 16);
      const h = terrainHeight(x, z);
      const slope = terrainNormalY(x, z);
      if (test(x, z, h, slope)) {
        place(x, z, h, slope, made);
        made++;
      }
    }
    return made;
  }

  function buildTrees() {
    const MAX = 320;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4329, roughness: 0.9 });
    const foliageGeo = new THREE.ConeGeometry(1.7, 4.6, 7);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x274c33, roughness: 0.85 });
    const snowGeo = new THREE.ConeGeometry(1.0, 1.4, 7);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xeaf3ff, roughness: 0.7 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX);
    const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, MAX);
    const caps = new THREE.InstancedMesh(snowGeo, snowMat, MAX);
    trunks.castShadow = foliage.castShadow = true;
    foliage.receiveShadow = true;

    let n = 0;
    scatter(MAX, (x, z, h, slope) => h > WATER_LEVEL + 1.5 && h < SNOW_LEVEL + 4 && slope > 0.82, (x, z, h) => {
      const sc = 0.7 + Math.random() * 0.7;
      const rot = Math.random() * Math.PI * 2;
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      _s.set(sc, sc, sc);
      _v.set(x, h + 1.0 * sc, z);
      _m.compose(_v, _q, _s);
      trunks.setMatrixAt(n, _m);
      _v.set(x, h + 3.4 * sc, z);
      _m.compose(_v, _q, _s);
      foliage.setMatrixAt(n, _m);
      _v.set(x, h + 5.0 * sc, z);
      _m.compose(_v, _q, _s);
      caps.setMatrixAt(n, _m);
      n++;
    });
    trunks.count = foliage.count = caps.count = n;
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    scene.add(trunks, foliage, caps);
  }

  function buildRocks() {
    const MAX = 150;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x747c85, roughness: 0.95, flatShading: true });
    const rocks = new THREE.InstancedMesh(geo, mat, MAX);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    let n = 0;
    scatter(MAX, (x, z, h) => h > WATER_LEVEL - 1, (x, z, h, slope) => {
      const sc = 0.5 + Math.random() * 1.8;
      _q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      _s.set(sc, sc * (0.6 + Math.random() * 0.5), sc);
      _v.set(x, h + sc * 0.3, z);
      _m.compose(_v, _q, _s);
      rocks.setMatrixAt(n, _m);
      n++;
    });
    rocks.count = n;
    rocks.instanceMatrix.needsUpdate = true;
    scene.add(rocks);
  }

  function buildGrass() {
    const MAX = 2600;
    const geo = new THREE.ConeGeometry(0.07, 0.6, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5e8a48, roughness: 1.0 });
    const grass = new THREE.InstancedMesh(geo, mat, MAX);
    let n = 0;
    scatter(MAX, (x, z, h, slope) => h > WATER_LEVEL + 0.8 && h < SNOW_LEVEL - 2 && slope > 0.9, (x, z, h) => {
      const sc = 0.6 + Math.random() * 0.9;
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
      _s.set(1, sc, 1);
      _v.set(x, h + 0.28 * sc, z);
      _m.compose(_v, _q, _s);
      grass.setMatrixAt(n, _m);
      n++;
    });
    grass.count = n;
    grass.instanceMatrix.needsUpdate = true;
    scene.add(grass);
  }

  // =========================================================================
  //  SNOW (weather particles)
  // =========================================================================
  const SNOW_COUNT = 900;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_COUNT * 3);
  const snowVel = new Float32Array(SNOW_COUNT);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 60;
    snowPos[i * 3 + 1] = Math.random() * 40;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    snowVel[i] = 2 + Math.random() * 3;
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false })
  );
  scene.add(snow);
  const weather = { snow: 0.4, target: 0.4, timer: 24 };

  // =========================================================================
  //  HERO  (tiny cloaked sword knight)
  // =========================================================================
  const hero = new THREE.Group();
  scene.add(hero);
  const heroParts = {};

  function buildHero() {
    hero.clear();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8b489, roughness: 0.7 });
    const tunic = new THREE.MeshStandardMaterial({ color: 0x3a5d8f, roughness: 0.7 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x4a3622, roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xc7d0db, roughness: 0.35, metalness: 0.7 });
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.8, side: THREE.DoubleSide });

    // torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.7, 10), tunic);
    torso.position.y = 1.0;
    torso.castShadow = true;
    hero.add(torso);

    // head + helmet
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 16), skin);
    head.position.y = 1.6;
    head.castShadow = true;
    hero.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 16, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    helmet.position.y = 1.63;
    hero.add(helmet);
    const noseGuard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.06), steel);
    noseGuard.position.set(0, 1.58, 0.22);
    hero.add(noseGuard);
    // eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a120b });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.08, 1.58, 0.2);
    eyeR.position.set(0.08, 1.58, 0.2);
    hero.add(eyeL, eyeR);

    // cloak
    const cloak = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.95, 1, 4), cloakMat);
    cloak.position.set(0, 1.05, -0.27);
    cloak.rotation.x = 0.18;
    cloak.castShadow = true;
    hero.add(cloak);
    heroParts.cloak = cloak;

    // legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.62, 8);
    const legL = new THREE.Mesh(legGeo, leather);
    const legR = new THREE.Mesh(legGeo, leather);
    legL.position.set(-0.13, 0.4, 0);
    legR.position.set(0.13, 0.4, 0);
    legL.castShadow = legR.castShadow = true;
    hero.add(legL, legR);
    heroParts.legL = legL;
    heroParts.legR = legR;

    // left arm (shield-ish)
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8);
    const armL = new THREE.Mesh(armGeo, tunic);
    armL.position.set(-0.32, 1.05, 0);
    armL.castShadow = true;
    hero.add(armL);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), steel);
    shield.rotation.z = Math.PI / 2;
    shield.rotation.y = Math.PI / 2;
    shield.position.set(-0.42, 1.0, 0.05);
    hero.add(shield);

    // right arm + sword (animated)
    const swordArm = new THREE.Group();
    swordArm.position.set(0.3, 1.18, 0.05);
    const armR = new THREE.Mesh(armGeo, tunic);
    armR.position.set(0, -0.18, 0.08);
    armR.rotation.x = 0.5;
    armR.castShadow = true;
    swordArm.add(armR);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), leather);
    hilt.position.set(0, -0.34, 0.28);
    hilt.rotation.x = Math.PI / 2.2;
    swordArm.add(hilt);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), steel);
    guard.position.set(0, -0.31, 0.34);
    swordArm.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.03), steel);
    blade.position.set(0, -0.3, 0.74);
    blade.rotation.x = Math.PI / 2.2;
    blade.castShadow = true;
    swordArm.add(blade);
    hero.add(swordArm);
    heroParts.swordArm = swordArm;

    hero.scale.set(1.05, 1.05, 1.05);
  }
  buildHero();

  // =========================================================================
  //  PLAYER STATE
  // =========================================================================
  const player = {
    pos: new THREE.Vector3(),
    vy: 0,
    onGround: false,
    facing: 0,
    walkPhase: 0,
  };
  const EYE = 1.55;

  function placePlayerStart() {
    // find a pleasant lowland spawn near centre
    let best = null;
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const h = terrainHeight(x, z);
      const slope = terrainNormalY(x, z);
      if (h > WATER_LEVEL + 1.5 && h < 18 && slope > 0.9) {
        best = { x, z, h };
        break;
      }
    }
    if (!best) best = { x: 0, z: 0, h: terrainHeight(0, 0) };
    player.pos.set(best.x, best.h, best.z);
    player.vy = 0;
  }

  let camYaw = 0;
  let camPitch = 0.35;
  let camDist = 6.2;
  let cameraMode = 1; // 1 = third person, 0 = first person
  let locked = false;
  const keys = Object.create(null);
  const mouseButtons = { left: false, right: false };
  let started = false;

  // touch controls state
  const touchMove = { id: null, fwd: 0, strafe: 0 };
  const touchLook = { id: null, x: 0, y: 0 };
  const touchBtn = { jump: false, sprint: false };

  const stats = {
    health: 100,
    energy: 100,
    coins: 0,
    cores: 0,
    xp: 0,
    level: 1,
    distance: 0,
    survivedSeconds: 0,
    enemiesDefeated: 0,
    bossWins: 0,
    score: 0,
  };

  const combat = { swing: 0, cooldown: 0, power: 2 };
  const lastPos = new THREE.Vector3();
  let damageCooldown = 0;
  let hintTimer = 0;
  let toastTimer = 0;
  let worldTime = 0.26;
  let dayLight = 1;
  let camShake = 0;

  // =========================================================================
  //  RUNESTONES (collectibles)
  // =========================================================================
  const runes = [];
  const RUNE_COUNT = 34;
  function spawnRunes() {
    for (const r of runes) scene.remove(r.mesh);
    runes.length = 0;
    let made = 0;
    let attempts = 0;
    while (made < RUNE_COUNT && attempts < RUNE_COUNT * 14) {
      attempts++;
      const x = (Math.random() - 0.5) * (WORLD - 24);
      const z = (Math.random() - 0.5) * (WORLD - 24);
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 1 || terrainNormalY(x, z) < 0.78) continue;
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42, 0),
        new THREE.MeshStandardMaterial({ color: 0x6ff0d8, emissive: 0x1f9c86, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 })
      );
      mesh.castShadow = true;
      mesh.position.set(x, h + 1.1, z);
      const glow = new THREE.PointLight(0x6ff0d8, 0.8, 6);
      glow.position.set(0, 0, 0);
      mesh.add(glow);
      scene.add(mesh);
      runes.push({ mesh, baseY: h + 1.1, t: Math.random() * 6, collected: false });
      made++;
    }
  }

  // =========================================================================
  //  ENEMIES (frost creatures)
  // =========================================================================
  const enemies = [];
  const ENEMY_COUNT = 9;
  const KINDS = {
    snowball: { color: 0xeaf4ff, emissive: 0x9fc4e8, hp: 2, speed: 1.0, dmg: 6, gold: 8, xp: 16, size: 0.5, name: "Snow Sprite" },
    wisp: { color: 0x8fd8ff, emissive: 0x3aa0e0, hp: 3, speed: 1.35, dmg: 7, gold: 12, xp: 22, size: 0.45, name: "Frost Wisp", float: true },
    brute: { color: 0x76b4d6, emissive: 0x2f6f9e, hp: 5, speed: 0.85, dmg: 9, gold: 18, xp: 30, size: 0.68, name: "Ice Brute" },
  };

  function buildEnemyMesh(kind) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: kind.color,
      emissive: new THREE.Color(kind.emissive).multiplyScalar(0.35),
      roughness: 0.4,
      metalness: 0.15,
    });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(kind.size, 1), mat);
    body.scale.y = kind.float ? 1.1 : 0.82;
    body.castShadow = true;
    g.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x10202c });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), eyeMat);
    const e2 = e1.clone();
    e1.position.set(-0.16, 0.12, kind.size * 0.82);
    e2.position.set(0.16, 0.12, kind.size * 0.82);
    g.add(e1, e2);
    g.userData.body = body;
    g.userData.baseEmissive = new THREE.Color(kind.emissive).multiplyScalar(0.35);
    return g;
  }

  function pickKind() {
    const r = Math.random();
    const night = 1 - dayLight;
    if (r < 0.2 + night * 0.2) return KINDS.brute;
    if (r < 0.55) return KINDS.wisp;
    return KINDS.snowball;
  }

  function spawnEnemy(e) {
    const kind = pickKind();
    e.kind = kind;
    e.hp = kind.hp;
    e.x = (Math.random() - 0.5) * (WORLD - 30);
    e.z = (Math.random() - 0.5) * (WORLD - 30);
    e.vx = 0;
    e.vz = 0;
    e.cooldown = 0;
    e.respawn = 0;
    e.wander = Math.random() * 6;
    e.flash = 0;
    e.active = true;
    if (e.mesh) scene.remove(e.mesh);
    e.mesh = buildEnemyMesh(kind);
    scene.add(e.mesh);
    e.mesh.visible = true;
  }

  function spawnEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const e = { mesh: null };
      spawnEnemy(e);
      enemies.push(e);
    }
  }

  // =========================================================================
  //  BOSS  (Frost King)
  // =========================================================================
  const boss = { mesh: null, active: false, x: 0, z: 0, y: 0, vx: 0, vz: 0, hp: 0, maxHp: 60, cooldown: 0, hop: 0, flash: 0, wins: 0 };
  let coresForBoss = 5;

  function buildBossMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9ad0ff, emissive: 0x2a5f9e, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 2), mat);
    body.scale.y = 0.9;
    body.castShadow = true;
    g.add(body);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0xffce6b, emissive: 0x6b5410, roughness: 0.3, metalness: 0.6 })
    );
    crown.position.y = 2.0;
    g.add(crown);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a1622 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), eyeMat);
    const e2 = e1.clone();
    e1.position.set(-0.55, 0.4, 1.7);
    e2.position.set(0.55, 0.4, 1.7);
    g.add(e1, e2);
    g.userData.body = body;
    return g;
  }

  function maybeSpawnBoss() {
    if (boss.active || stats.cores < coresForBoss) return;
    if (!boss.mesh) {
      boss.mesh = buildBossMesh();
      scene.add(boss.mesh);
    }
    const a = Math.random() * Math.PI * 2;
    boss.x = clamp(player.pos.x + Math.cos(a) * 11, -HALF + 4, HALF - 4);
    boss.z = clamp(player.pos.z + Math.sin(a) * 11, -HALF + 4, HALF - 4);
    boss.maxHp = 50 + stats.level * 9;
    boss.hp = boss.maxHp;
    boss.active = true;
    boss.cooldown = 0;
    boss.hop = 0;
    boss.flash = 0;
    boss.mesh.visible = true;
    coresForBoss += 8;
    ui.bossBar.classList.remove("hidden");
    ui.bossName.textContent = "❄️ The Frost King";
    showToast("❄️ The Frost King rises! Swing your sword (L-Click)!");
    blip(110, 0.45, "sawtooth", 0.2);
    camShake = 0.7;
  }

  function damageBoss(amount, kx, kz) {
    boss.hp -= amount;
    boss.flash = 0.18;
    boss.vx += kx * 1.2;
    boss.vz += kz * 1.2;
    spawnParticles(boss.x, boss.y + 1.2, boss.z, 0xbfe6ff, 9, 3.2);
    blip(300, 0.07, "square", 0.12);
    if (boss.hp <= 0) defeatBoss();
  }

  function defeatBoss() {
    boss.active = false;
    boss.mesh.visible = false;
    ui.bossBar.classList.add("hidden");
    boss.wins++;
    stats.bossWins = (stats.bossWins || 0) + 1;
    const reward = 130 + stats.level * 22;
    stats.coins += reward;
    addXp(160);
    stats.health = 100;
    for (let i = 0; i < 7; i++) spawnParticles(boss.x, boss.y + 1.2, boss.z, [0xffce6b, 0xbfe6ff, 0x9ad0ff][i % 3], 22, 5);
    camShake = 0.9;
    blip(720, 0.5, "triangle", 0.18);
    showToast(`🏆 You defeated the Frost King! +${reward} gold`);
  }

  // =========================================================================
  //  PARTICLES
  // =========================================================================
  const PARTICLES = 240;
  const particles = [];
  let particleGroup = null;
  function initParticles() {
    if (particleGroup) return;
    particleGroup = new THREE.Group();
    scene.add(particleGroup);
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      particleGroup.add(m);
      particles.push({ mesh: m, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0 });
    }
  }
  function spawnParticles(x, y, z, color, count, spread) {
    if (!particleGroup) return;
    let done = 0;
    for (const p of particles) {
      if (p.life > 0) continue;
      p.life = p.maxLife = 0.5 + Math.random() * 0.35;
      p.vx = (Math.random() - 0.5) * spread;
      p.vy = 1.7 + Math.random() * spread;
      p.vz = (Math.random() - 0.5) * spread;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.7);
      p.mesh.visible = true;
      if (++done >= count) break;
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
  }

  // =========================================================================
  //  HELPERS
  // =========================================================================
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function xpToNext(level) {
    return 90 + level * 30;
  }

  function computeScore() {
    return (
      stats.coins * 8 +
      stats.cores * 12 +
      stats.level * 45 +
      Math.floor(stats.distance) +
      stats.enemiesDefeated * 16 +
      (stats.bossWins || 0) * 220
    );
  }

  function addXp(amount) {
    stats.xp += amount;
    let leveled = false;
    while (stats.xp >= xpToNext(stats.level)) {
      stats.xp -= xpToNext(stats.level);
      stats.level += 1;
      stats.health = Math.min(100, stats.health + 14);
      stats.energy = 100;
      combat.power = 2 + Math.floor(stats.level * 0.4);
      leveled = true;
    }
    if (leveled) {
      blip(820, 0.14, "triangle", 0.16);
      showToast(`🎉 Level up! You are now Level ${stats.level}!`);
      camShake = Math.min(0.5, camShake + 0.2);
      const cols = [0xffce6b, 0xbfe6ff, 0x6fe39a, 0xc7b0ff];
      for (let i = 0; i < cols.length; i++) spawnParticles(player.pos.x, player.pos.y + 1.4, player.pos.z, cols[i], 14, 4.5);
    }
  }

  function applyDamage(amount, reason) {
    if (damageCooldown > 0) return;
    stats.health = Math.max(0, stats.health - amount);
    damageCooldown = 0.7;
    camShake = Math.min(0.55, camShake + 0.25);
    blip(170, 0.12, "sawtooth", 0.2);
    if (reason) showToast(reason);
  }

  function showToast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    toastTimer = 2.2;
  }
  function updateToast(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.classList.remove("show");
    }
  }

  // =========================================================================
  //  QUESTS
  // =========================================================================
  const QUESTS = [
    { key: "cores", target: 5, title: "Gather 5 Runestones ✨", gold: 35, xp: 75 },
    { key: "enemiesDefeated", target: 4, title: "Defeat 4 Frost Creatures ⚔️", gold: 40, xp: 90 },
    { key: "distance", target: 220, title: "Explore 220 Steps 👣", gold: 28, xp: 68 },
    { key: "cores", target: 8, title: "Gather 8 Runestones ✨", gold: 55, xp: 110 },
  ];
  let quest = null;
  function chooseQuest() {
    quest = { ...QUESTS[(Math.random() * QUESTS.length) | 0] };
    renderQuest();
  }
  function renderQuest() {
    if (!quest) return;
    const p = Math.min(quest.target, Math.floor(stats[quest.key] || 0));
    ui.questProgress.textContent = `${quest.title} · ${p}/${quest.target}`;
  }
  function checkQuest() {
    if (!quest) return;
    if (Math.floor(stats[quest.key] || 0) >= quest.target) {
      stats.coins += quest.gold;
      addXp(quest.xp);
      showToast(`Quest complete! +${quest.gold} gold`);
      chooseQuest();
    } else {
      renderQuest();
    }
  }

  // =========================================================================
  //  HUD
  // =========================================================================
  function renderStats() {
    stats.score = computeScore();
    ui.healthFill.style.width = `${stats.health}%`;
    ui.healthText.textContent = `${Math.round(stats.health)} / 100`;
    ui.energyFill.style.width = `${stats.energy}%`;
    ui.energyText.textContent = `${Math.round(stats.energy)} / 100`;
    const next = xpToNext(stats.level);
    ui.xpFill.style.width = `${Math.min(100, (stats.xp / next) * 100)}%`;
    ui.xpText.textContent = `${Math.floor(stats.xp)} / ${next} XP`;
    ui.levelText.textContent = String(stats.level);
    ui.coinsText.textContent = String(stats.coins);
    ui.coresText.textContent = String(stats.cores);
    ui.scoreText.textContent = String(stats.score);
    ui.modeBadge.textContent = `Camera: ${cameraMode === 0 ? "First" : "Third"} Person (F5)`;
    renderQuest();
  }

  function setBackendBadge(online, text) {
    ui.backendDot.style.background = online ? "#54d27a" : "#7c8895";
    ui.backendText.textContent = text || (online ? "Backend Online" : "Backend Offline");
  }

  // =========================================================================
  //  BACKEND
  // =========================================================================
  function sanitizeName(n) {
    const c = String(n || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 18);
    return c || "KalumHero";
  }

  async function api(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${API_ROOT}${path}`, {
        method: options?.method || "GET",
        headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function initBackend() {
    try {
      const info = await api("/world-config");
      state.backendOnline = true;
      if (typeof info.seed === "number") state.worldSeed = info.seed >>> 0;
      if (typeof info.dailyChallenge === "string" && info.dailyChallenge.trim()) state.dailyChallenge = info.dailyChallenge.trim();
      ui.dailyText.textContent = state.dailyChallenge;
      setBackendBadge(true);
    } catch (e) {
      state.backendOnline = false;
      ui.dailyText.textContent = "Backend offline — you can still play, but saves and the leaderboard need the server running.";
      setBackendBadge(false);
    }
  }

  async function loadLeaderboard() {
    if (!state.backendOnline) {
      ui.boardList.innerHTML = '<div class="entry"><span>No backend yet</span><b>--</b></div>';
      return;
    }
    try {
      const data = await api("/leaderboard");
      const rows = Array.isArray(data.entries) ? data.entries : [];
      if (!rows.length) {
        ui.boardList.innerHTML = '<div class="entry"><span>No scores yet</span><b>0</b></div>';
        return;
      }
      ui.boardList.innerHTML = rows
        .slice(0, 12)
        .map((row, i) => `<div class="entry"><span>#${i + 1} ${sanitizeName(row.name)}</span><b>${Number(row.score || 0)}</b></div>`)
        .join("");
    } catch (e) {
      ui.boardList.innerHTML = '<div class="entry"><span>Leaderboard error</span><b>!</b></div>';
    }
  }

  async function saveProgress(manual) {
    if (!state.backendOnline || state.saveInFlight || !state.playerName) return;
    state.saveInFlight = true;
    try {
      await api("/save", {
        method: "POST",
        body: {
          playerName: state.playerName,
          worldSeed: state.worldSeed,
          cameraMode,
          position: { x: +player.pos.x.toFixed(3), y: +player.pos.y.toFixed(3), z: +player.pos.z.toFixed(3) },
          stats: {
            health: +stats.health.toFixed(2),
            energy: +stats.energy.toFixed(2),
            coins: stats.coins,
            cores: stats.cores,
            xp: +stats.xp.toFixed(2),
            level: stats.level,
            distance: +stats.distance.toFixed(2),
            survivedSeconds: +stats.survivedSeconds.toFixed(2),
            score: stats.score,
          },
        },
      });
      if (manual) showToast("Progress saved.");
    } catch (e) {
      if (manual) showToast("Save failed. Is the backend running?");
      state.backendOnline = false;
      setBackendBadge(false, "Backend Unreachable");
    } finally {
      state.saveInFlight = false;
    }
  }

  async function loadSave() {
    if (!state.backendOnline || !state.playerName) return;
    try {
      const data = await api(`/save/${encodeURIComponent(state.playerName)}`);
      if (!data || !data.save) return;
      const sv = data.save;
      if (sv.position && Number.isFinite(sv.position.x)) {
        player.pos.set(sv.position.x, sv.position.y, sv.position.z);
      }
      if (sv.stats) {
        stats.health = clamp(+sv.stats.health || 100, 1, 100);
        stats.energy = clamp(+sv.stats.energy || 100, 0, 100);
        stats.coins = (+sv.stats.coins || 0) | 0;
        stats.cores = (+sv.stats.cores || 0) | 0;
        stats.xp = +sv.stats.xp || 0;
        stats.level = Math.max(1, (+sv.stats.level || 1) | 0);
        stats.distance = +sv.stats.distance || 0;
        stats.survivedSeconds = +sv.stats.survivedSeconds || 0;
        combat.power = 2 + Math.floor(stats.level * 0.4);
        coresForBoss = Math.max(5, Math.ceil((stats.cores + 1) / 8) * 8 - 3);
      }
      if (Number.isFinite(+sv.cameraMode)) cameraMode = +sv.cameraMode === 0 ? 0 : 1;
      showToast("Loaded your saved adventure.");
    } catch (e) {
      state.backendOnline = false;
      setBackendBadge(false, "Backend Unreachable");
    }
  }

  async function loadProfile() {
    if (!state.backendOnline || !state.playerName) return;
    try {
      const data = await api(`/profile/${encodeURIComponent(state.playerName)}`);
      state.profileBest = Number(data?.bestScore || 0);
      if (state.profileBest > 0) showToast(`Welcome back! Best score: ${state.profileBest}`);
    } catch (e) {}
  }

  async function submitScore(reason) {
    if (!state.backendOnline || !state.playerName) return;
    try {
      await api("/leaderboard", {
        method: "POST",
        body: {
          name: state.playerName,
          score: computeScore(),
          level: stats.level,
          coins: stats.coins,
          cores: stats.cores,
          distance: +stats.distance.toFixed(2),
          survivedSeconds: +stats.survivedSeconds.toFixed(2),
          reason: reason || "checkpoint",
        },
      });
      await loadLeaderboard();
    } catch (e) {
      state.backendOnline = false;
      setBackendBadge(false, "Backend Unreachable");
    }
  }

  // =========================================================================
  //  AUDIO
  // =========================================================================
  let actx = null;
  function ensureAudio() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }
  function blip(freq, dur, type, vol) {
    try {
      const ctx = ensureAudio();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "square";
      o.frequency.value = freq || 420;
      g.gain.value = vol || 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(Math.max(80, (freq || 420) * 0.6), ctx.currentTime + dur);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  const MUSIC_NOTES = [220, 261.63, 293.66, 329.63, 293.66, 246.94, 220, 196];
  const music = { on: false, timer: 0, step: 0, gain: null };
  function startMusic() {
    const ctx = ensureAudio();
    if (music.on) return;
    music.on = true;
    music.gain = ctx.createGain();
    music.gain.gain.value = 0.045;
    music.gain.connect(ctx.destination);
    music.timer = 0;
    ui.musicBtn.textContent = "🔊 Music";
  }
  function stopMusic() {
    music.on = false;
    if (music.gain) {
      try {
        music.gain.disconnect();
      } catch (e) {}
      music.gain = null;
    }
    ui.musicBtn.textContent = "🔈 Music";
  }
  function toggleMusic() {
    music.on ? stopMusic() : startMusic();
  }
  function updateMusic(dt) {
    if (!music.on || !music.gain) return;
    music.timer -= dt;
    if (music.timer > 0) return;
    music.timer = 0.62;
    const ctx = actx;
    const note = MUSIC_NOTES[music.step++ % MUSIC_NOTES.length] * (dayLight > 0.4 ? 1 : 0.5);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = note;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g);
    g.connect(music.gain);
    o.start();
    o.stop(ctx.currentTime + 0.62);
  }

  // =========================================================================
  //  INPUT
  // =========================================================================
  function requestLock() {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener("mousemove", (e) => {
    if (!locked || !started) return;
    camYaw -= e.movementX * 0.0022;
    camPitch -= e.movementY * 0.0022;
    camPitch = clamp(camPitch, -0.4, 1.2);
  });
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(e.code)) e.preventDefault();
    if (e.code === "F5" && started) {
      e.preventDefault();
      cameraMode = cameraMode === 0 ? 1 : 0;
      ui.cross.style.display = cameraMode === 0 ? "block" : "none";
      showToast(cameraMode === 0 ? "First person view" : "Third person view");
      renderStats();
    }
    if (e.code === "KeyM" && started) {
      e.preventDefault();
      toggleMusic();
    }
    if (e.code === "Escape") ui.board.classList.add("hidden");
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!started || isTouch) return;
    if (!locked) {
      requestLock();
      return;
    }
    if (e.button === 0) {
      mouseButtons.left = true;
      swingSword();
    } else if (e.button === 2) {
      mouseButtons.right = true;
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouseButtons.left = false;
    if (e.button === 2) mouseButtons.right = false;
  });
  window.addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    mouseButtons.left = mouseButtons.right = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // =========================================================================
  //  TOUCH CONTROLS (iPad / phones)
  // =========================================================================
  function setupTouch() {
    const joy = ui.joy;
    const knob = ui.joyKnob;
    const R = 46;

    function joyFrom(t) {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      touchMove.strafe = dx / R;
      touchMove.fwd = -dy / R;
    }
    function resetJoy() {
      touchMove.id = null;
      touchMove.fwd = 0;
      touchMove.strafe = 0;
      knob.style.transform = "translate(0,0)";
    }

    joy.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchMove.id = t.identifier;
      joyFrom(t);
    }, { passive: false });
    joy.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === touchMove.id) joyFrom(t);
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchMove.id) resetJoy();
    };
    joy.addEventListener("touchend", endJoy, { passive: false });
    joy.addEventListener("touchcancel", () => resetJoy(), { passive: false });

    // look: drags anywhere on the canvas that aren't on a control
    canvas.addEventListener("touchstart", (e) => {
      if (!started) return;
      for (const t of e.changedTouches) {
        if (touchLook.id === null) {
          touchLook.id = t.identifier;
          touchLook.x = t.clientX;
          touchLook.y = t.clientY;
        }
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      if (!started) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === touchLook.id) {
          camYaw -= (t.clientX - touchLook.x) * 0.005;
          camPitch -= (t.clientY - touchLook.y) * 0.005;
          camPitch = clamp(camPitch, -0.4, 1.2);
          touchLook.x = t.clientX;
          touchLook.y = t.clientY;
        }
      }
    }, { passive: false });
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchLook.id) touchLook.id = null;
    };
    canvas.addEventListener("touchend", endLook, { passive: false });
    canvas.addEventListener("touchcancel", endLook, { passive: false });

    const bind = (el, on, off) => {
      el.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        on();
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (off) off();
      };
      el.addEventListener("touchend", up, { passive: false });
      el.addEventListener("touchcancel", up, { passive: false });
    };
    bind(ui.btnJump, () => { touchBtn.jump = true; }, () => { touchBtn.jump = false; });
    bind(ui.btnAttack, () => { mouseButtons.left = true; swingSword(); }, () => { mouseButtons.left = false; });
    bind(ui.btnSprint, () => {
      touchBtn.sprint = !touchBtn.sprint;
      ui.btnSprint.classList.toggle("on", touchBtn.sprint);
    }, null);
  }

  // =========================================================================
  //  COMBAT
  // =========================================================================
  function swingSword() {
    if (combat.cooldown > 0) return;
    combat.cooldown = 0.36;
    combat.swing = 1;
    blip(240, 0.07, "triangle", 0.08);
    const reach = 2.8;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const ox = player.pos.x;
    const oz = player.pos.z;
    let hit = false;
    for (const en of enemies) {
      if (!en.active) continue;
      const ex = en.x - ox;
      const ez = en.z - oz;
      const d = Math.hypot(ex, ez);
      if (d > reach) continue;
      const dot = (ex / (d || 1)) * dir.x + (ez / (d || 1)) * dir.z;
      if (dot > 0.3) {
        hurtEnemy(en, combat.power, dir.x, dir.z);
        hit = true;
      }
    }
    if (boss.active) {
      const ex = boss.x - ox;
      const ez = boss.z - oz;
      const d = Math.hypot(ex, ez);
      if (d < reach + 1.2) {
        const dot = (ex / (d || 1)) * dir.x + (ez / (d || 1)) * dir.z;
        if (dot > 0.15) {
          damageBoss(combat.power, dir.x, dir.z);
          hit = true;
        }
      }
    }
    if (hit) camShake = Math.min(0.5, camShake + 0.16);
  }

  function hurtEnemy(en, amount, kx, kz) {
    en.hp -= amount;
    en.flash = 0.18;
    en.vx += kx * 3.2;
    en.vz += kz * 3.2;
    spawnParticles(en.x, en.y + 0.3, en.z, 0xffffff, 6, 2.2);
    blip(330, 0.06, "square", 0.1);
    if (en.hp <= 0) defeatEnemy(en);
  }

  function defeatEnemy(en) {
    en.active = false;
    if (en.mesh) en.mesh.visible = false;
    en.respawn = 14 + Math.random() * 10;
    const k = en.kind;
    stats.coins += k.gold;
    addXp(k.xp);
    stats.enemiesDefeated++;
    spawnParticles(en.x, en.y, en.z, k.color, 16, 3.4);
    blip(560, 0.12, "square", 0.14);
    showToast(`${k.name} defeated! +${k.gold} gold`);
  }

  // =========================================================================
  //  UPDATE STEP
  // =========================================================================
  function updateMovement(dt) {
    const sinY = Math.sin(camYaw);
    const cosY = Math.cos(camYaw);
    let fwd = 0;
    let strafe = 0;
    if (keys.KeyW) fwd += 1;
    if (keys.KeyS) fwd -= 1;
    if (keys.KeyA) strafe -= 1;
    if (keys.KeyD) strafe += 1;
    fwd += touchMove.fwd;
    strafe += touchMove.strafe;
    fwd = Math.max(-1, Math.min(1, fwd));
    strafe = Math.max(-1, Math.min(1, strafe));
    let mx = fwd * -sinY + strafe * cosY;
    let mz = fwd * -cosY + strafe * -sinY;
    const moving = Math.abs(fwd) > 0.06 || Math.abs(strafe) > 0.06;
    if (moving) {
      const l = Math.hypot(mx, mz) || 1;
      mx /= l;
      mz /= l;
    } else {
      mx = 0;
      mz = 0;
    }
    const sprint = moving && ((keys.ShiftLeft || keys.ShiftRight) || touchBtn.sprint) && stats.energy > 6;
    const sneak = keys.ControlLeft || keys.ControlRight;
    const speed = sprint ? 9.2 : sneak ? 3.0 : 5.6;
    stats.energy = sprint ? Math.max(0, stats.energy - 26 * dt) : Math.min(100, stats.energy + 20 * dt);

    // horizontal move with terrain clamp
    let nx = player.pos.x + mx * speed * dt;
    let nz = player.pos.z + mz * speed * dt;
    nx = clamp(nx, -HALF + 3, HALF - 3);
    nz = clamp(nz, -HALF + 3, HALF - 3);
    player.pos.x = nx;
    player.pos.z = nz;

    // gravity + jump
    const groundY = terrainHeight(player.pos.x, player.pos.z);
    player.vy -= 23 * dt;
    if ((keys.Space || touchBtn.jump) && player.onGround && stats.energy >= 8) {
      player.vy = 8.6;
      player.onGround = false;
      stats.energy = Math.max(0, stats.energy - 8);
      blip(420, 0.1, "sine", 0.12);
    }
    player.pos.y += player.vy * dt;
    if (player.pos.y <= groundY) {
      if (player.vy < -16) applyDamage(Math.min(26, Math.round(Math.abs(player.vy))), "Ouch! Hard landing.");
      player.pos.y = groundY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // drowning-ish: lose a little health if deep in water
    if (player.pos.y < WATER_LEVEL - 0.4) {
      if (Math.random() < dt * 1.5) applyDamage(3, "Brrr! The water is freezing!");
    }

    // facing
    if (moving) {
      const target = Math.atan2(mx, mz);
      let diff = target - player.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.facing += diff * Math.min(1, dt * 12);
    }
    player.walkPhase += dt * (moving ? (sprint ? 16 : 10) : 0);

    // distance
    stats.distance += Math.hypot(player.pos.x - lastPos.x, player.pos.z - lastPos.z);
    lastPos.copy(player.pos);

    if (damageCooldown > 0) damageCooldown -= dt;
  }

  function updateHeroVisual() {
    hero.position.set(player.pos.x, player.pos.y, player.pos.z);
    hero.rotation.y = player.facing;
    hero.visible = cameraMode === 1;
    const sw = Math.sin(player.walkPhase) * 0.5;
    if (heroParts.legL) heroParts.legL.rotation.x = sw;
    if (heroParts.legR) heroParts.legR.rotation.x = -sw;
    if (heroParts.cloak) heroParts.cloak.rotation.x = 0.18 + Math.abs(sw) * 0.25 + Math.sin(performance.now() * 0.003) * 0.05;
    if (heroParts.swordArm) {
      if (combat.swing > 0) {
        const a = (1 - combat.swing) * Math.PI;
        heroParts.swordArm.rotation.x = -Math.sin(a) * 2.2;
        heroParts.swordArm.rotation.z = Math.sin(a) * 0.6;
      } else {
        heroParts.swordArm.rotation.x = -0.2 + Math.cos(player.walkPhase) * 0.15;
        heroParts.swordArm.rotation.z = 0;
      }
    }
  }

  function updateCamera() {
    if (combat.cooldown > 0) combat.cooldown -= 1 / 60;
    if (combat.swing > 0) combat.swing = Math.max(0, combat.swing - (1 / 60) * 3.4);

    const speed = 0; // fov managed simply
    camera.fov = 70;
    const eyeY = player.pos.y + EYE;
    if (cameraMode === 0) {
      const cp = Math.cos(camPitch);
      const dir = new THREE.Vector3(-Math.sin(camYaw) * cp, Math.sin(camPitch), -Math.cos(camYaw) * cp);
      camera.position.set(player.pos.x, eyeY, player.pos.z);
      camera.lookAt(player.pos.x + dir.x, eyeY + dir.y, player.pos.z + dir.z);
      return;
    }
    const horiz = camDist * Math.cos(camPitch);
    let cx = player.pos.x + Math.sin(camYaw) * horiz;
    let cz = player.pos.z + Math.cos(camYaw) * horiz;
    let cy = eyeY + camDist * Math.sin(camPitch);
    // keep camera above terrain
    const groundAtCam = terrainHeight(cx, cz) + 1.2;
    if (cy < groundAtCam) cy = groundAtCam;
    camera.position.set(cx, cy, cz);
    camera.lookAt(player.pos.x, eyeY - 0.2, player.pos.z);
  }

  function applyCamShake() {
    if (camShake <= 0) return;
    camShake = Math.max(0, camShake - 0.05);
    const a = camShake * 0.18;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
    camera.position.z += (Math.random() - 0.5) * a;
  }

  function updateDayNight(dt) {
    worldTime = (worldTime + dt / 260) % 1;
    const day = Math.max(0, Math.sin(worldTime * Math.PI * 2));
    dayLight = day;
    // sky colors
    skyUniforms.top.value.setHSL(0.6, 0.55, 0.12 + day * 0.38);
    skyUniforms.bottom.value.setHSL(0.58, 0.4, 0.28 + day * 0.55);
    scene.fog.color.setHSL(0.58, 0.32, 0.22 + day * 0.55);
    renderer.toneMappingExposure = 0.7 + day * 0.5;
    sun.intensity = 0.25 + day * 1.35;
    hemi.intensity = 0.25 + day * 0.7;
    ambient.intensity = 0.18 + day * 0.18;
    stars.material.opacity = Math.max(0, 0.9 - day * 1.2);

    const a = worldTime * Math.PI * 2;
    const sx = Math.cos(a) * 160;
    const sy = Math.sin(a) * 150 + 30;
    const sz = Math.sin(a * 0.6) * 120;
    sun.position.set(player.pos.x + sx, sy, player.pos.z + sz);
    sun.target.position.set(player.pos.x, player.pos.y, player.pos.z);
    sunDisc.position.set(player.pos.x + sx * 1.6, sy * 1.4, player.pos.z + sz * 1.6);
    moonDisc.position.set(player.pos.x - sx * 1.6, -sy * 1.4 + 40, player.pos.z - sz * 1.6);
    moonDisc.material.opacity = Math.max(0.15, 1 - day);
    moonDisc.material.transparent = true;
    sky.position.copy(player.pos);
    stars.position.copy(player.pos);
  }

  function updateWeather(dt) {
    weather.timer -= dt;
    if (weather.timer <= 0) {
      weather.timer = 28 + Math.random() * 30;
      weather.target = 0.2 + Math.random() * 0.8;
    }
    weather.snow += (weather.target - weather.snow) * Math.min(1, dt * 0.4);
    snow.material.opacity = 0.5 + weather.snow * 0.4;
    snow.position.set(player.pos.x, player.pos.y, player.pos.z);
    const arr = snow.geometry.attributes.position.array;
    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3;
      arr[i3] += Math.sin((i + worldTime * 80) * 0.5) * dt * 0.4;
      arr[i3 + 1] -= snowVel[i] * dt * (0.5 + weather.snow);
      arr[i3 + 2] += Math.cos((i + worldTime * 60) * 0.4) * dt * 0.4;
      if (arr[i3 + 1] < -4) {
        arr[i3] = (Math.random() - 0.5) * 60;
        arr[i3 + 1] = 36 + Math.random() * 8;
        arr[i3 + 2] = (Math.random() - 0.5) * 60;
      }
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }

  function updateRunes(dt) {
    let active = 0;
    for (const r of runes) {
      if (r.collected) continue;
      active++;
      r.t += dt;
      r.mesh.rotation.y += dt * 1.6;
      r.mesh.position.y = r.baseY + Math.sin(r.t * 2.2) * 0.18;
      if (r.mesh.position.distanceTo(player.pos) < 1.6) {
        r.collected = true;
        r.mesh.visible = false;
        stats.cores++;
        stats.coins += 10;
        addXp(24);
        stats.health = Math.min(100, stats.health + 4);
        spawnParticles(r.mesh.position.x, r.mesh.position.y, r.mesh.position.z, 0x6ff0d8, 16, 3.6);
        blip(900, 0.1, "triangle", 0.14);
        checkQuest();
      }
    }
    if (active === 0) {
      spawnRunes();
      showToast("✨ New runestones appeared across the land.");
    }
  }

  function updateEnemies(dt) {
    const now = performance.now();
    for (const en of enemies) {
      if (!en.active) {
        en.respawn -= dt;
        if (en.respawn <= 0) spawnEnemy(en);
        continue;
      }
      const k = en.kind;
      const dx = player.pos.x - en.x;
      const dz = player.pos.z - en.z;
      const d2 = dx * dx + dz * dz;
      const night = 1 + (1 - dayLight) * 0.4;
      const chase = d2 < 110 * night;
      const sp = (chase ? 1.8 : 0.9) * k.speed * night;
      if (chase) {
        const inv = 1 / Math.max(0.001, Math.sqrt(d2));
        en.vx += dx * inv * sp * dt * 3.4;
        en.vz += dz * inv * sp * dt * 3.4;
      } else {
        en.wander += dt * 0.9;
        en.vx += Math.cos(en.wander * 1.2) * dt * 0.8;
        en.vz += Math.sin(en.wander * 1.05) * dt * 0.8;
      }
      en.vx *= Math.pow(0.2, dt);
      en.vz *= Math.pow(0.2, dt);
      en.x = clamp(en.x + en.vx * dt, -HALF + 3, HALF - 3);
      en.z = clamp(en.z + en.vz * dt, -HALF + 3, HALF - 3);
      const gy = terrainHeight(en.x, en.z);
      const floatY = k.float ? 0.6 + Math.sin(now * 0.004 + en.x) * 0.25 : 0;
      en.y = gy + k.size * 0.8 + floatY;
      en.mesh.position.set(en.x, en.y, en.z);
      en.mesh.rotation.y = Math.atan2(dx, dz);
      if (!k.float) en.mesh.scale.y = 0.82 + Math.sin(now * 0.006 + en.x) * 0.08;

      if (en.flash > 0) {
        en.flash -= dt;
        const f = Math.max(0, en.flash / 0.18);
        en.mesh.userData.body.material.emissive.copy(en.mesh.userData.baseEmissive).addScalar(f * 0.8);
      }

      if (en.cooldown > 0) en.cooldown -= dt;
      const horiz = Math.hypot(dx, dz);
      if (horiz < 1.2) {
        if (player.vy < -4 && player.pos.y > gy + 0.6) {
          player.vy = 7;
          defeatEnemy(en);
        } else if (en.cooldown <= 0) {
          en.cooldown = 1.2;
          applyDamage(Math.round(k.dmg * (0.8 + (1 - dayLight) * 0.4)), `A ${k.name} struck you!`);
        }
      }
    }
  }

  function updateBoss(dt) {
    if (!boss.active) {
      maybeSpawnBoss();
      return;
    }
    const dx = player.pos.x - boss.x;
    const dz = player.pos.z - boss.z;
    const d = Math.hypot(dx, dz) || 1;
    boss.hop -= dt;
    if (boss.hop <= 0) {
      boss.hop = 1.1;
      boss.vx += (dx / d) * 3.0;
      boss.vz += (dz / d) * 3.0;
    }
    boss.vx *= Math.pow(0.1, dt);
    boss.vz *= Math.pow(0.1, dt);
    boss.x = clamp(boss.x + boss.vx * dt, -HALF + 4, HALF - 4);
    boss.z = clamp(boss.z + boss.vz * dt, -HALF + 4, HALF - 4);
    const gy = terrainHeight(boss.x, boss.z);
    const hop = Math.abs(Math.sin(performance.now() * 0.004)) * 0.5;
    boss.y = gy + 2.0 + hop;
    boss.mesh.position.set(boss.x, boss.y, boss.z);
    boss.mesh.rotation.y = Math.atan2(dx, dz);
    if (boss.flash > 0) {
      boss.flash -= dt;
      boss.mesh.userData.body.material.emissiveIntensity = 0.6 + Math.max(0, boss.flash / 0.18) * 2;
    }
    if (boss.cooldown > 0) boss.cooldown -= dt;
    if (d < 3 && boss.cooldown <= 0) {
      boss.cooldown = 1.5;
      applyDamage(13, "❄️ The Frost King smashed you!");
      camShake = Math.min(0.6, camShake + 0.3);
    }
    ui.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }

  function updateVignette() {
    let op = 0;
    if (damageCooldown > 0.4) op = 0.55;
    else if (stats.health <= 30) op = 0.26 + Math.sin(performance.now() * 0.006) * 0.08;
    ui.vignette.style.opacity = String(op);
  }

  async function onKO() {
    stats.health = 60;
    stats.energy = 100;
    if (boss.active) {
      boss.active = false;
      if (boss.mesh) boss.mesh.visible = false;
      ui.bossBar.classList.add("hidden");
    }
    camShake = 0.4;
    spawnParticles(player.pos.x, player.pos.y + 1, player.pos.z, 0xfff1c0, 14, 3);
    placePlayerStart();
    lastPos.copy(player.pos);
    await submitScore("knockout");
    showToast("💫 You were knocked out, but woke up safe.");
  }

  // =========================================================================
  //  MAIN LOOP
  // =========================================================================
  const clock = new THREE.Clock();

  function update(dt) {
    stats.survivedSeconds += dt;
    hintTimer += dt;
    if (hintTimer > 14) ui.hint.style.opacity = "0";

    updateMovement(dt);

    if (mouseButtons.left && combat.cooldown <= 0) {
      let near = boss.active && Math.hypot(boss.x - player.pos.x, boss.z - player.pos.z) < 3.6;
      if (!near) {
        for (const en of enemies) {
          if (en.active && Math.hypot(en.x - player.pos.x, en.z - player.pos.z) < 3) {
            near = true;
            break;
          }
        }
      }
      if (near) swingSword();
    }

    updateDayNight(dt);
    updateWeather(dt);
    updateRunes(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateParticles(dt);
    updateHeroVisual();
    updateCamera();
    applyCamShake();
    updateMusic(dt);
    updateVignette();

    if (stats.health <= 0) onKO();

    checkQuest();
    renderStats();
    ui.px.textContent = Math.round(player.pos.x);
    ui.py.textContent = Math.round(player.pos.y);
    ui.pz.textContent = Math.round(player.pos.z);
    updateToast(dt);

    state.autosaveTimer += dt;
    if (state.autosaveTimer >= 24) {
      state.autosaveTimer = 0;
      saveProgress(false);
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    if (started) update(dt);
    renderer.render(scene, camera);
  }

  // =========================================================================
  //  START / WIRING
  // =========================================================================
  async function begin() {
    if (started || state.startInProgress) return;
    state.startInProgress = true;
    state.playerName = sanitizeName(ui.nameInput.value);
    ui.nameInput.value = state.playerName;
    ui.playerTag.textContent = state.playerName;
    ui.start.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    ui.board.classList.add("hidden");
    if (isTouch) {
      ui.touch.classList.remove("hidden");
      ui.hint.textContent = "Left stick = move · Drag screen = look · Buttons = jump & attack";
    } else {
      requestLock();
    }
    await loadSave();
    await loadProfile();
    renderStats();
    lastPos.copy(player.pos);
    await submitScore("session_start");
    showToast(state.backendOnline ? "Adventure begins! Progress auto-saves." : "Adventure begins in offline mode.");
    blip(660, 0.1, "sine", 0.12);
    startMusic();
    started = true;
    state.startInProgress = false;
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  ui.start.addEventListener("click", (e) => {
    if (e.target === ui.start) begin();
  });
  ui.playBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    begin();
  });
  ui.nameInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      e.preventDefault();
      begin();
    }
  });
  ui.saveBtn.addEventListener("click", () => saveProgress(true));
  ui.musicBtn.addEventListener("click", () => toggleMusic());
  ui.boardBtn.addEventListener("click", async () => {
    if (!started) return;
    ui.board.classList.toggle("hidden");
    if (!ui.board.classList.contains("hidden")) {
      await submitScore("board_open");
      await loadLeaderboard();
    }
  });

  // =========================================================================
  //  BOOTSTRAP
  // =========================================================================
  async function bootstrap() {
    await initBackend();
    seed = state.worldSeed >>> 0;
    buildTerrain();
    buildWater();
    buildTrees();
    buildRocks();
    buildGrass();
    initParticles();
    spawnRunes();
    spawnEnemies();
    placePlayerStart();
    lastPos.copy(player.pos);
    chooseQuest();
    renderStats();
    if (isTouch) setupTouch();
    await loadLeaderboard();
    loop();
  }

  bootstrap();
})();
