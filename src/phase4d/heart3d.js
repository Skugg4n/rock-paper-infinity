/**
 * Chapter IV · THE DEEP, the dig (v1.92.7, Ola: "a more real heart"): the heart in 3D, rendered with
 * three.js (the importmap's) into a small offscreen canvas that the 2D picture draws in. A sculpted mesh
 * (a sphere pushed into the heart's form: the ventricles to a tilted apex, the atria as two softer lobes
 * on top, the groove between the sides), a wet, deep red material with a clear coat and a fibrous bump,
 * the coronary vessels as tubes lying on its surface, fat in the grooves, the aorta, the pulmonary trunk
 * and the great veins as tubes rising out of the top into the rock. Lit by the drone's lamp from above.
 * The beat (lub-dub) squeezes the mesh. Rendered at most 20 times a second, at a low resolution.
 *
 * createHeart3D() resolves to null where there is no WebGL (tests, old machines): the 2D heart is used.
 */

export const H3_W = 460, H3_H = 760;
/** Where the heart's centre is in the canvas (the picture draws it there). */
export const H3_CY = 505;

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
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, H3_W / H3_H, 0.1, 50);
    camera.position.set(0, 1.0, 7.2);
    camera.lookAt(0, 1.0, 0);

    // ---- the form: a unit sphere pushed into a heart
    const gauss = (d, w) => Math.exp(-(d * d) / (w * w));
    const noise = (x, y, z) => Math.sin(x * 7.1 + y * 3.3) * Math.sin(y * 6.7 - z * 4.1) * Math.sin(z * 5.9 + x * 2.3);
    function form(nx, ny, nz) {
        let x = nx, y = ny, z = nz;
        // narrower toward the apex, broad at the base
        const taper = 0.5 + 0.5 * Math.min(1, Math.max(0, (y + 1) / 1.6));
        x *= 0.95 * taper + 0.08; z *= 0.78 * taper + 0.06;
        y *= 1.25;
        // the apex pulled down and to the left
        if (y < 0) { x -= 0.32 * (-y) ** 1.4; y -= 0.12 * (-y) ** 2; }
        // the atria: two soft lobes on top, the right one fuller
        const la = gauss(Math.hypot(nx + 0.42, ny - 0.82, nz - 0.1), 0.42), ra = gauss(Math.hypot(nx - 0.45, ny - 0.75, nz - 0.2), 0.45);
        const lobe = 0.22 * la + 0.28 * ra;
        // the groove between the two ventricles (front), a little inward, and its fat
        const groove = gauss(nx - 0.12 * ny - 0.08, 0.09) * (nz > 0 ? 1 : 0.4) * (ny < 0.7 ? 1 : 0.2);
        // the coronary groove round the base
        const ring = gauss(ny - 0.52, 0.07);
        const muscle = 0.015 * noise(nx * 2, ny * 2, nz * 2) + 0.008 * Math.sin(ny * 28 + nx * 9);
        const k = 1 + lobe + muscle - 0.07 * groove - 0.05 * ring;
        return [x * k, y * k + 0.25 * lobe, z * k];
    }
    const geo = new THREE.SphereGeometry(1, 128, 128);
    const pos = geo.attributes.position;
    const base = new Float32Array(pos.array.length);
    for (let i = 0; i < pos.count; i++) {
        const [x, y, z] = form(pos.getX(i), pos.getY(i), pos.getZ(i));
        pos.setXYZ(i, x, y, z);
    }
    base.set(pos.array);
    geo.computeVertexNormals();

    // a fibrous bump: muscle running in curved bands, and fine wet noise
    const bumpC = document.createElement('canvas'); bumpC.width = 512; bumpC.height = 512;
    const b = bumpC.getContext('2d');
    b.fillStyle = '#808080'; b.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 220; k++) {
        b.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${(0.06 + Math.random() * 0.1).toFixed(3)})`;
        b.lineWidth = 1 + Math.random() * 3;
        const y0 = Math.random() * 600 - 40;
        b.beginPath(); b.moveTo(-20, y0);
        b.bezierCurveTo(150, y0 - 60 + Math.random() * 40, 350, y0 + 80 + Math.random() * 40, 540, y0 + 20);
        b.stroke();
    }
    for (let k = 0; k < 3000; k++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.08)`; b.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    const bump = new THREE.CanvasTexture(bumpC);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(2, 2);

    const flesh = new THREE.MeshPhysicalMaterial({
        color: 0x7c0f1e, roughness: 0.42, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.28,
        sheen: 0.6, sheenColor: new THREE.Color(0xff5a6e), sheenRoughness: 0.5, bumpMap: bump, bumpScale: 0.035,
    });
    const heart = new THREE.Mesh(geo, flesh);
    const group = new THREE.Group();
    group.add(heart);

    // a point on the surface, from a direction (the same form), a little out
    const surf = (dx, dy, dz, out = 1.012) => {
        const l = Math.hypot(dx, dy, dz);
        const [x, y, z] = form(dx / l, dy / l, dz / l);
        return new THREE.Vector3(x * out, y * out, z * out);
    };
    const vesselMat = new THREE.MeshPhysicalMaterial({ color: 0x4a0a1a, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color(0xc04060) });
    const veinMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1238, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.3 });
    const fatMat = new THREE.MeshPhysicalMaterial({ color: 0xa88a5c, roughness: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.35 });
    const tube = (pts, r, mat, seg = 64) => {
        const curve = new THREE.CatmullRomCurve3(pts);
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10, false), mat);
        group.add(m);
        return m;
    };
    // coronary vessels lying on the surface: down the front groove, round the base, branches
    const along = (dirs, out) => dirs.map(([x, y, z]) => surf(x, y, z, out));
    tube(along([[0.1, 0.62, 0.9], [0.06, 0.3, 1], [0.0, -0.1, 1], [-0.12, -0.5, 0.9], [-0.32, -0.85, 0.6]], 1.02), 0.035, vesselMat);
    tube(along([[0.12, 0.6, 0.9], [0.5, 0.5, 0.8], [0.9, 0.45, 0.35], [1, 0.42, -0.2]], 1.02), 0.03, vesselMat);
    tube(along([[0.06, 0.2, 1], [-0.35, 0.05, 0.9], [-0.7, -0.15, 0.6], [-0.85, -0.35, 0.3]], 1.02), 0.022, vesselMat);
    tube(along([[0.03, -0.15, 1], [0.35, -0.3, 0.9], [0.55, -0.5, 0.7]], 1.02), 0.018, vesselMat);
    tube(along([[0.6, 0.45, 0.7], [0.65, 0.1, 0.75], [0.55, -0.3, 0.7], [0.3, -0.65, 0.6]], 1.02), 0.02, veinMat);
    // fat in the grooves: small soft lumps along the front groove and the base
    // (irregular, half sunk into the groove, thinning toward the apex)
    const rnd = (k) => { const v = Math.sin(k * 12.9898) * 43758.5453; return v - Math.floor(v); };
    for (let k = 0; k < 9; k++) {
        const u = k / 8 + (rnd(k) - 0.5) * 0.06;
        const p = surf(0.1 - 0.12 * u + (rnd(k + 9) - 0.5) * 0.05, 0.62 - 0.75 * u, 0.95, 0.99);
        const f = new THREE.Mesh(new THREE.SphereGeometry((0.045 + 0.03 * rnd(k + 3)) * (1 - u * 0.6), 10, 8), fatMat);
        f.position.copy(p); f.scale.set(1.6, 0.6 + rnd(k + 5) * 0.4, 0.6); f.rotation.z = rnd(k + 7); group.add(f);
    }
    for (let k = 0; k < 8; k++) {
        const a = -0.5 + k * 0.22 + (rnd(k + 20) - 0.5) * 0.1;
        const p = surf(Math.sin(a), 0.55, Math.cos(a), 0.99);
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.04 + 0.03 * rnd(k + 30), 10, 8), fatMat);
        f.position.copy(p); f.scale.set(1.8, 0.6, 0.7); group.add(f);
    }
    // the great vessels: out of the top, arching up into the rock (out of the frame)
    const top = (x, z) => surf(x, 1, z, 0.95);
    tube([top(0.05, 0.1), new THREE.Vector3(0.1, 1.9, 0.15), new THREE.Vector3(0.55, 2.7, 0), new THREE.Vector3(1.1, 2.85, -0.3), new THREE.Vector3(1.15, 2.2, -0.9), new THREE.Vector3(0.75, 1.3, -1.0), new THREE.Vector3(0.4, 0.8, -0.9)], 0.26, vesselMat, 96);    // the aorta's arch, down behind the heart
    tube([new THREE.Vector3(0.75, 2.75, -0.05), new THREE.Vector3(0.8, 3.6, 0), new THREE.Vector3(0.7, 4.6, 0)], 0.09, vesselMat);
    tube([new THREE.Vector3(1.05, 2.82, -0.1), new THREE.Vector3(1.2, 3.7, -0.1), new THREE.Vector3(1.3, 4.6, -0.1)], 0.08, vesselMat);
    tube([top(-0.3, 0.35), new THREE.Vector3(-0.5, 1.8, 0.4), new THREE.Vector3(-0.95, 2.4, 0.2), new THREE.Vector3(-1.2, 3.2, 0), new THREE.Vector3(-1.25, 4.7, -0.2)], 0.22, vesselMat, 96);  // the pulmonary trunk, up into the rock
    tube([top(0.62, -0.3), new THREE.Vector3(0.8, 2.0, -0.4), new THREE.Vector3(0.85, 3.2, -0.5), new THREE.Vector3(0.9, 4.6, -0.5)], 0.2, veinMat);              // the vena cava
    tube([top(-0.55, -0.4), new THREE.Vector3(-0.9, 1.5, -0.7), new THREE.Vector3(-1.1, 2.6, -0.9), new THREE.Vector3(-1.0, 4.7, -1.0)], 0.14, veinMat);         // the pulmonary veins
    group.rotation.set(0.15, -0.35, 0.42);
    scene.add(group);

    // the light: the drone's lamp from above and in front, a warm key; a cold rim behind; a red fill as if from inside
    const key = new THREE.DirectionalLight(0xfff1d8, 2.3); key.position.set(-1.5, 3.5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 1.0); rim.position.set(3, 1, -3); scene.add(rim);
    const fill = new THREE.PointLight(0xff3040, 6, 8, 2); fill.position.set(0.5, -1.2, 2); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x3a0a12, 1.2));

    let lastAt = -1;
    const out = document.createElement('canvas');
    out.width = H3_W; out.height = H3_H;
    const o = out.getContext('2d');
    const mask = o.createRadialGradient(H3_W / 2, H3_CY - 40, 120, H3_W / 2, H3_CY - 40, 300);
    mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(0.7, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    return {
        canvas: out, cy: H3_CY,
        /**
         * Renders the heart now: `sq` the beat's squeeze (0 to ~0.12), `swell` 0 to 0.12 as the sleepers arrive.
         * At most 20 times a second.
         */
        render(sq, swell = 0) {
            const now = performance.now();
            if (now - lastAt < 50) return out;
            lastAt = now;
            // the squeeze: the ventricles pull in toward the axis and up, the apex twists a little
            const a = pos.array;
            for (let i = 0; i < pos.count; i++) {
                const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
                const vent = y < 0.5 ? 1 : 0.3;
                const s2 = 1 - sq * 1.4 * vent + swell;
                a[i * 3] = x * s2; a[i * 3 + 1] = y * (1 - sq * 0.5 * vent) + sq * 0.12; a[i * 3 + 2] = z * s2;
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            fill.intensity = 6 + sq * 60;
            group.rotation.z = 0.42 + sq * 0.15;
            renderer.render(scene, camera);
            // soft edges: what reaches the edge of the picture fades into the dark (no cut tubes)
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
