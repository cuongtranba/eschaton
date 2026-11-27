import * as THREE from "three";

export type Tri3 = readonly (readonly [number, number, number])[];
export type Line3 = Readonly<{ a: readonly [number, number, number]; b: readonly [number, number, number]; color: string; dashed?: boolean }>;
export type Look = "clay" | "silhouette";

export type CameraSpec =
  | Readonly<{ kind: "ortho"; dir: readonly [number, number, number]; up?: readonly [number, number, number]; halfHeight: number; target: readonly [number, number, number] }>
  | Readonly<{ kind: "persp"; azimuth: number; elevation: number; distance: number; fov: number; target: readonly [number, number, number] }>;

export type ClayView = Readonly<{
  element: HTMLElement;
  set: (polygons: readonly Tri3[], lines: readonly Line3[], look: Look) => void;
}>;

const CLAY = 0xb9b4aa;

function camera(spec: CameraSpec, aspect: number): THREE.Camera {
  const target = new THREE.Vector3(...spec.target);
  if (spec.kind === "ortho") {
    const h = spec.halfHeight;
    const cam = new THREE.OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.01, 200);
    cam.position.copy(target).add(new THREE.Vector3(...spec.dir).normalize().multiplyScalar(50));
    cam.up.set(...(spec.up ?? [0, 1, 0]));
    cam.lookAt(target);
    return cam;
  }
  const [az, el] = [(spec.azimuth * Math.PI) / 180, (spec.elevation * Math.PI) / 180];
  const cam = new THREE.PerspectiveCamera(spec.fov, aspect, 0.01, 200);
  cam.position.copy(target).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(spec.distance));
  cam.lookAt(target);
  return cam;
}

/** One renderer, many fixed-camera viewports (scissor). Neutral clay: one matte material, fixed key/fill/rim lights. */
export function createClayStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setScissorTest(true);
  const views: { view: ClayView; scene: THREE.Scene; spec: CameraSpec; background: THREE.Color }[] = [];

  const addView = (element: HTMLElement, spec: CameraSpec): ClayView => {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a958c, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 9, 6);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-6, 3, -2);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-3, 5, -8);
    const under = new THREE.DirectionalLight(0xffffff, 0.45);
    under.position.set(1, -6, 2);
    scene.add(key, fill, rim, under);
    const group = new THREE.Group();
    scene.add(group);
    const background = new THREE.Color(0xdedbd5);
    const set = (polygons: readonly Tri3[], lines: readonly Line3[], look: Look): void => {
      for (const child of group.children) {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          const g: unknown = child.geometry;
          if (g instanceof THREE.BufferGeometry) g.dispose();
          const m: unknown = child.material;
          if (m instanceof THREE.Material) m.dispose();
        }
      }
      group.clear();
      const positions: number[] = [];
      for (const poly of polygons) {
        const first = poly[0];
        if (first === undefined) continue;
        for (let i = 1; i + 1 < poly.length; i++) {
          const [b, c] = [poly[i], poly[i + 1]];
          if (b !== undefined && c !== undefined) positions.push(...first, ...b, ...c);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      const material =
        look === "clay"
          ? new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.88, metalness: 0, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
          : new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
      group.add(new THREE.Mesh(geometry, material));
      background.set(look === "clay" ? 0xdedbd5 : 0xffffff);
      const byStyle = new Map<string, number[]>();
      for (const line of look === "clay" ? lines : []) {
        const key2 = `${line.color}|${line.dashed === true ? 1 : 0}`;
        byStyle.set(key2, [...(byStyle.get(key2) ?? []), ...line.a, ...line.b]);
      }
      for (const [style, pts] of byStyle) {
        const [color = "#000000", dashed] = style.split("|");
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const m = dashed === "1" ? new THREE.LineDashedMaterial({ color, dashSize: 0.05, gapSize: 0.04 }) : new THREE.LineBasicMaterial({ color });
        const seg = new THREE.LineSegments(g, m);
        if (dashed === "1") seg.computeLineDistances();
        group.add(seg);
      }
    };
    const view: ClayView = { element, set };
    views.push({ view, scene, spec, background });
    return view;
  };

  const render = (): void => {
    const [width, height] = [window.innerWidth, window.innerHeight];
    renderer.setSize(width, height, false);
    renderer.setScissor(0, 0, width, height);
    renderer.setClearColor(0x2a2b2f, 1);
    renderer.clear();
    for (const v of views) {
      const rect = v.view.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > height || rect.width < 2 || rect.height < 2) continue;
      const y = height - rect.bottom;
      renderer.setViewport(rect.left, y, rect.width, rect.height);
      renderer.setScissor(rect.left, y, rect.width, rect.height);
      renderer.setClearColor(v.background, 1);
      renderer.clear();
      renderer.render(v.scene, camera(v.spec, rect.width / rect.height));
    }
  };
  return { addView, render };
}
