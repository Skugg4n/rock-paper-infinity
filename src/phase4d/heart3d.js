/**
 * Chapter IV · THE DEEP, the dig: the heart in 3D (v1.92.7, redone in v1.92.8 after Ola's reference:
 * "more depth, less neon. Deep red/brown. Hidden in darkness, visible only in the light of the drone's lamp").
 *
 * three.js (the importmap's) renders into a small offscreen canvas that the 2D picture draws in.
 * - The form: a big rounded body with a clear apex; the right atrium and its auricle bulging at the upper
 *   left, the left auricle at the right; a lumpy, irregular muscle surface (noise displacement); the grooves
 *   darker (vertex colour).
 * - The colour: oxblood and liver brown, wet: a clear coat gives pale, warm highlights. No red glow.
 * - The vessels: the aortic arch with its three branches, the pulmonary trunk and the superior vena cava rise
 *   from the top as thick tubes with fine ribs across them; the coronary arteries and veins are tubes built
 *   along paths ON the surface (they follow its curve), branching from the top groove toward the apex.
 * - The light: the drone's lamp only, a spotlight from where the drone is and the way it faces; the rest
 *   falls into black (a very faint rim). The beat is a squeeze of the whole and a shift of the sheen.
 * Cheap: built once; per frame only the group's scale, the lamp and one render, at most 20 times a second.
 * createHeart3D() resolves to null where there is no WebGL: the 2D heart is used.
 */

export const H3_W = 460, H3_H = 760;
/** Where the heart's centre is in the canvas, and how many canvas pixels a world unit is (at the heart). */
export const H3_CY = 505, H3_PX = 125;

/** A small, seeded value noise in 3D (smooth), -1 to 1. */
function makeNoise(seed = 7) {
    const p = new Uint8Array(512);
    let a = seed >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 256; i++) p[256 + i] = p[i];
    const h = (x, y, z) => p[p[p[x & 255] + (y & 255)] + (z & 255)] / 127.5 - 1;
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y, z) => {
        const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        const xf = s(x - xi), yf = s(y - yi), zf = s(z - zi);
        const l = (a0, b0, t) => a0 + (b0 - a0) * t;
        return l(
            l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
            l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf),
            zf);
    };
}

export async function createHeart3D() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.WebGLRenderingContext) return null;
    let THREE;
    try { THREE = await import('three'); } catch { return null; }
    const canvas = document.createElement('canvas');
    canvas.width = H3_W; canvas.height = H3_H;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch { return null; }
    renderer.setPixelRatio(1);
    renderer.setSize(H3_W, H3_H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, H3_W / H3_H, 0.1, 50);
    camera.position.set(0, 1.0, 7.2);
    camera.lookAt(0, 1.0, 0);

    const noise = makeNoise(11);
    const gauss = (d, w) => Math.exp(-(d * d) / (w * w));
    /** The groove's darkness at a direction (0 to 1): the front groove down to the apex, the ring at the base. */
    const grooveAt = (nx, ny, nz) => {
        const front = gauss(nx - (0.08 + 0.18 * ny), 0.1) * (nz > -0.1 ? 1 : 0) * (ny < 0.6 ? 1 : 0.3);
        const ring = gauss(ny - 0.5, 0.08) * (Math.abs(nx) < 0.85 ? 1 : 0.5);
        return Math.min(1, front + ring);
    };
    /** The form: a direction on the unit sphere to a point on the heart. */
    function form(nx, ny, nz) {
        let x = nx * 1.0, y = ny * 1.12, z = nz * 0.86;
        // narrower toward the apex: a clear point, a little left of the middle
        const down = Math.max(0, -ny);
        const taper = 1 - 0.42 * down ** 1.3;
        x *= taper; z *= taper;
        if (ny < 0) { x -= 0.18 * down ** 2; y -= 0.22 * down ** 2.2; }
        // the right atrium and its auricle at the upper left, the left auricle at the right
        const ra = gauss(Math.hypot(nx + 0.78, ny - 0.5, nz - 0.25), 0.42);
        const rau = gauss(Math.hypot(nx + 0.5, ny - 0.82, nz - 0.5), 0.26);
        const lau = gauss(Math.hypot(nx - 0.72, ny - 0.62, nz - 0.4), 0.3);
        // the top flattens where the great vessels come out
        const top = gauss(Math.hypot(nx - 0.05, ny - 1, nz), 0.35);
        // lumpy muscle: three octaves of noise
        const lumps = 0.035 * noise(nx * 3, ny * 3, nz * 3) + 0.018 * noise(nx * 7 + 3, ny * 7, nz * 7) + 0.008 * noise(nx * 15, ny * 15 + 5, nz * 15);
        const k = 1 + 0.26 * ra + 0.18 * rau + 0.2 * lau - 0.12 * top + lumps - 0.05 * grooveAt(nx, ny, nz);
        return [x * k, y * k, z * k];
    }
    const geo = new THREE.SphereGeometry(1, 112, 112);
    const pos = geo.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
        const [x, y, z] = form(nx, ny, nz);
        pos.setXYZ(i, x, y, z);
        // the colour: oxblood to liver brown, darker in the grooves and the crevices, a little lighter on the lumps
        const g = grooveAt(nx, ny, nz);
        const v = 0.9 + 0.12 * noise(nx * 5 + 9, ny * 5, nz * 5);
        const sh = (1 - 0.5 * g) * v;
        colours[i * 3] = sh * 1.0; colours[i * 3 + 1] = sh * (0.95 + 0.08 * noise(nx * 4, ny * 4 + 2, nz * 4)); colours[i * 3 + 2] = sh * 0.95;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.computeVertexNormals();

    // fine wet texture for the muscle, and the ribs across the great vessels
    const bumpC = document.createElement('canvas'); bumpC.width = 256; bumpC.height = 256;
    const b = bumpC.getContext('2d');
    b.fillStyle = '#808080'; b.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 2500; k++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.12)`; b.beginPath(); b.arc(Math.random() * 256, Math.random() * 256, 0.6 + Math.random() * 1.8, 0, Math.PI * 2); b.fill(); }
    const bump = new THREE.CanvasTexture(bumpC);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(4, 4);
    const ribC = document.createElement('canvas'); ribC.width = 64; ribC.height = 256;
    const rb = ribC.getContext('2d');
    rb.fillStyle = '#808080'; rb.fillRect(0, 0, 64, 256);
    for (let k = 0; k < 64; k++) { rb.fillStyle = k % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)'; rb.fillRect(0, k * 4 + (Math.random() - 0.5), 64, 1.5 + Math.random()); }
    const ribs = new THREE.CanvasTexture(ribC);
    ribs.wrapS = ribs.wrapT = THREE.RepeatWrapping; ribs.repeat.set(20, 1);

    const flesh = new THREE.MeshPhysicalMaterial({
        color: 0x4a140f, vertexColors: true, roughness: 0.55, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.16, bumpMap: bump, bumpScale: 0.018,
        sheen: 0.25, sheenColor: new THREE.Color(0x8a4a3a), sheenRoughness: 0.6,
    });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, flesh));

    // ---- the great vessels, ribbed
    const vesselMat = new THREE.MeshPhysicalMaterial({ color: 0x5a1912, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.14, bumpMap: ribs, bumpScale: 0.03 });
    const tube = (pts, r, mat, seg = 64, rad = 14) => {
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, rad, false), mat);
        group.add(m);
        return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // (they start a little inside the heart's top, so they grow out of it)
    tube([V(0.12, 0.85, 0.05), V(0.15, 1.6, 0.1), V(0.3, 2.35, 0.05), V(0.75, 2.75, -0.1), V(1.15, 2.6, -0.35), V(1.25, 2.0, -0.7), V(1.1, 1.0, -0.95)], 0.3, vesselMat, 96, 18);   // the aortic arch
    tube([V(0.38, 2.62, -0.02), V(0.36, 3.2, 0), V(0.34, 4.2, 0)], 0.11, vesselMat, 24);                          // its branches
    tube([V(0.72, 2.78, -0.12), V(0.75, 3.4, -0.1), V(0.78, 4.2, -0.1)], 0.1, vesselMat, 24);
    tube([V(1.0, 2.7, -0.25), V(1.15, 3.2, -0.25), V(1.35, 4.0, -0.25)], 0.09, vesselMat, 24);
    tube([V(0.3, 0.8, 0.45), V(0.42, 1.4, 0.5), V(0.75, 1.75, 0.4), V(1.3, 1.85, 0.25), V(1.75, 1.95, 0.1)], 0.24, vesselMat, 64, 16);   // the pulmonary trunk, to the right
    tube([V(-0.6, 0.75, 0.0), V(-0.62, 1.5, 0.0), V(-0.6, 2.4, 0.0), V(-0.58, 4.2, 0)], 0.24, vesselMat, 48, 16);                         // the superior vena cava
    tube([V(1.0, 0.95, 0.1), V(1.4, 1.1, 0.05), V(1.9, 1.15, 0.0)], 0.13, vesselMat, 24);                                               // a pulmonary vein, right

    // ---- the coronary vessels: tubes along paths on the surface, a little raised, branching toward the apex
    const coronary = new THREE.MeshPhysicalMaterial({ color: 0x400a08, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
    const vein = new THREE.MeshPhysicalMaterial({ color: 0x241010, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12 });
    /** A path on the surface through directions (on the unit sphere), as points just over the skin. */
    let pathN = 0;
    const onSkin = (dirs, n = 36, lift = 1.016) => {
        const pts = [];
        const seed = 13 + 7 * pathN++;
        for (let i = 0; i <= n; i++) {
            const f = (i / n) * (dirs.length - 1), j = Math.min(dirs.length - 2, Math.floor(f)), u = f - j;
            const a = dirs[j], c = dirs[j + 1];
            // a vessel wanders a little as it goes (not a ruled line)
            const w = 0.05 * noise(i * 0.35, seed, 1.7), w2 = 0.03 * noise(seed, i * 0.6, 4.1);
            let x = a[0] + (c[0] - a[0]) * u + w, y = a[1] + (c[1] - a[1]) * u + w2, z = a[2] + (c[2] - a[2]) * u;
            const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
            const [px, py, pz] = form(x, y, z);
            pts.push(V(px * lift, py * lift, pz * lift));
        }
        return pts;
    };
    const vessel = (dirs, r, mat = coronary) => tube(onSkin(dirs), r * 0.8, mat, 64, 8);
    // the front (anterior descending) artery, in its groove, from the top to the apex
    vessel([[0.18, 0.62, 0.75], [0.15, 0.35, 0.92], [0.1, 0.05, 1], [0.02, -0.3, 0.95], [-0.08, -0.62, 0.78], [-0.15, -0.9, 0.45]], 0.034);
    // its branches, diagonal, both ways
    vessel([[0.14, 0.3, 0.94], [0.32, 0.1, 0.94], [0.5, -0.12, 0.85], [0.62, -0.32, 0.72]], 0.022);
    vessel([[0.1, 0.0, 1], [0.3, -0.2, 0.93], [0.42, -0.45, 0.8]], 0.018);
    vessel([[0.12, 0.2, 0.97], [-0.12, 0.05, 0.99], [-0.32, -0.15, 0.93], [-0.45, -0.38, 0.8]], 0.02);
    vessel([[0.04, -0.25, 0.97], [-0.18, -0.42, 0.89], [-0.3, -0.62, 0.72]], 0.016);
    // the right coronary artery round the base on the left side, and its marginal branch down
    vessel([[0.1, 0.6, 0.8], [-0.25, 0.55, 0.8], [-0.6, 0.45, 0.66], [-0.85, 0.3, 0.42]], 0.03);
    vessel([[-0.7, 0.4, 0.58], [-0.72, 0.1, 0.68], [-0.62, -0.25, 0.72], [-0.45, -0.6, 0.66]], 0.02);
    // the circumflex to the right, round the base, and a branch down the right side
    vessel([[0.2, 0.6, 0.78], [0.5, 0.55, 0.68], [0.82, 0.42, 0.4]], 0.026);
    vessel([[0.7, 0.48, 0.53], [0.8, 0.15, 0.58], [0.78, -0.2, 0.55], [0.6, -0.55, 0.55]], 0.019);
    // veins, darker, alongside
    vessel([[0.24, 0.55, 0.8], [0.25, 0.25, 0.93], [0.2, -0.05, 0.98], [0.13, -0.35, 0.93]], 0.022, vein);
    vessel([[-0.5, 0.42, 0.75], [-0.55, 0.05, 0.83], [-0.5, -0.3, 0.8]], 0.016, vein);

    group.rotation.set(0.12, -0.22, 0.16);
    scene.add(group);

    // ---- the light: the drone's lamp only (a spotlight with falloff), a very faint rim
    const lamp = new THREE.SpotLight(0xfff0dc, 80, 16, 0.85, 0.8, 1.5);
    lamp.position.set(0, 2, 3);
    scene.add(lamp);
    scene.add(lamp.target);
    const rim = new THREE.DirectionalLight(0x6a5050, 0.12); rim.position.set(2, 3, -3); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x120606, 0.25));

    const out = document.createElement('canvas');
    out.width = H3_W; out.height = H3_H;
    const o = out.getContext('2d');
    const mask = o.createRadialGradient(H3_W / 2, H3_CY - 40, 140, H3_W / 2, H3_CY - 40, 320);
    mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(0.75, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    let lastAt = -1;
    return {
        canvas: out, cy: H3_CY,
        /**
         * Renders the heart now, at most 20 times a second.
         * @param {number} sq the beat's squeeze (0 to ~0.12)
         * @param {number} swell 0 to 0.12, as the sleepers arrive
         * @param {{x: number, y: number, face: number}} drone where the drone is, in canvas pixels from the heart's
         *   centre (y down), and the way it faces (-1, 1): its lamp is the light
         */
        render(sq, swell = 0, drone = { x: 0, y: -300, face: 1 }) {
            const now = performance.now();
            if (now - lastAt < 50) return out;
            lastAt = now;
            // the squeeze: the whole pulls in and up a little; the sheen shifts with it
            const s = 1 + swell;
            group.scale.set(s * (1 - sq * 0.9), s * (1 - sq * 0.35), s * (1 - sq * 0.9));
            group.position.y = sq * 0.15;
            flesh.clearcoatRoughness = 0.16 + sq * 0.6;
            // the lamp where the drone is, a little in front of the rock, pointing down and the way it faces
            const lx = drone.x / H3_PX, ly = -drone.y / H3_PX;
            lamp.position.set(lx, ly + 0.3, 3.0);
            lamp.target.position.set(lx + drone.face * 0.7, ly - 1.3, 0);
            renderer.render(scene, camera);
            // soft edges: what reaches the edge of the picture fades into the dark
            o.globalCompositeOperation = 'copy';
            o.drawImage(canvas, 0, 0);
            o.globalCompositeOperation = 'destination-in';
            o.fillStyle = mask;
            o.fillRect(0, 0, H3_W, H3_H);
            o.globalCompositeOperation = 'source-over';
            return out;
        },
        dispose() { renderer.dispose(); },
    };
}
