import * as THREE from 'three';

/**
 * The ALCHE "A" prism, rebuilt procedurally to the measured proportions:
 *  - equilateral triangle, apex up, side S = 1
 *  - depth 0.2446 * width
 *  - concentric apex-up triangular hole, side ≈ 0.437 * S
 *  - rectangular slot in the bottom edge (width 0.55*S, height 0.04*S)
 *    that splits the base into two feet — this is what reads as the "A"
 *  - rounded bevel on every rim edge
 * Local width is normalised to the GLB's 0.4333 so world transforms
 * (scale 3 inside, 4.3 outside) land at the same on-screen size.
 */

const GLB_WIDTH = 0.4333;
const GLB_DEPTH = 0.1060;

function trianglePoints(side, cy = 0) {
  // equilateral, apex up, centroid at origin offset cy
  const h = side * Math.SQRT1_2 * Math.sqrt(1.5); // side * sqrt(3)/2
  const apex = new THREE.Vector2(0, cy + (2 / 3) * h);
  const bl = new THREE.Vector2(-side / 2, cy - h / 3);
  const br = new THREE.Vector2(side / 2, cy - h / 3);
  return { apex, bl, br, h };
}

export function buildLogoGeometry() {
  const S = GLB_WIDTH;                     // outer silhouette width
  const depth = GLB_DEPTH;
  const outer = trianglePoints(S);
  const holeSide = 0.437 * S;
  const hole = trianglePoints(holeSide, 0.001 * S);

  const slotW = 0.55 * S;
  const slotH = 0.032 * S;                 // slot rises this far above base
  const baseY = outer.bl.y;

  // Outer outline with the foot slot cut into the bottom edge,
  // traced counter-clockwise starting at the bottom-left corner.
  const shape = new THREE.Shape();
  shape.moveTo(outer.bl.x, baseY);
  shape.lineTo(-slotW / 2, baseY);         // left foot top edge start
  shape.lineTo(-slotW / 2, baseY + slotH); // up into the slot
  shape.lineTo(slotW / 2, baseY + slotH);  // across
  shape.lineTo(slotW / 2, baseY);          // down
  shape.lineTo(outer.br.x, baseY);         // right foot
  shape.lineTo(outer.apex.x, outer.apex.y);
  shape.closePath();

  const holePath = new THREE.Path();
  holePath.moveTo(hole.br.x, hole.br.y);
  holePath.lineTo(hole.bl.x, hole.bl.y);
  holePath.lineTo(hole.apex.x, hole.apex.y);
  holePath.closePath();
  shape.holes.push(holePath);

  const bevel = 0.019 * S;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments: 8
  });
  geo.center();

  // UVs normalised to the silhouette box (the shader tiles noise over them)
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / size.x,
      (pos.getY(i) - bb.min.y) / size.y
    );
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Clean hidden-line outline for the light scene: the A silhouette (outer
 * ring with the foot slot + inner counter) traced at the front and back
 * faces plus corner connectors — one crisp line, no bevel rings.
 */
export function buildLogoOutlineGeometry(logoGeo) {
  const S = GLB_WIDTH;
  const depth = GLB_DEPTH;
  const outer = trianglePoints(S);
  const hole = trianglePoints(0.437 * S, 0.001 * S);
  const slotW = 0.55 * S;
  const slotH = 0.032 * S;
  const baseY = outer.bl.y;

  const outerRing = [
    [outer.bl.x, baseY],
    [-slotW / 2, baseY],
    [-slotW / 2, baseY + slotH],
    [slotW / 2, baseY + slotH],
    [slotW / 2, baseY],
    [outer.br.x, baseY],
    [outer.apex.x, outer.apex.y]
  ];
  const innerRing = [
    [hole.bl.x, hole.bl.y],
    [hole.br.x, hole.br.y],
    [hole.apex.x, hole.apex.y]
  ];

  // vertical recentre matching geo.center() on the extruded mesh
  const cy = (outer.apex.y + baseY + slotH / 2) / 2;
  const z = depth / 2;
  const pts = [];
  const ring = (loop, zz) => {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      pts.push(a[0], a[1] - cy, zz, b[0], b[1] - cy, zz);
    }
  };
  ring(outerRing, z);
  ring(outerRing, -z);
  ring(innerRing, z);
  ring(innerRing, -z);
  // connectors at the outer corners + slot corners
  for (const p of [...outerRing, ...innerRing]) {
    pts.push(p[0], p[1] - cy, z, p[0], p[1] - cy, -z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

/**
 * The side-screen quad glued to the left slanted face of the prism.
 * u runs along depth (0 = back, 1 = front), v runs along the edge
 * (0 = bottom corner, 1 = apex).
 */
export function buildSideScreenGeometry() {
  const S = GLB_WIDTH;
  const outer = trianglePoints(S);
  // pull the corners in slightly so the quad sits on the flank
  const t0 = 0.03, t1 = 0.97;
  const bottom = new THREE.Vector2().lerpVectors(outer.bl, outer.apex, t0);
  const top = new THREE.Vector2().lerpVectors(outer.bl, outer.apex, t1);
  const zHalf = GLB_DEPTH / 2 * 1.012;     // slightly proud of the face

  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // x, y, z            u = depth, v = edge
    bottom.x, bottom.y, -zHalf,
    bottom.x, bottom.y, zHalf,
    top.x, top.y, -zHalf,
    top.x, top.y, zHalf
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 0, 1, 1, 1
  ]);
  const idx = [0, 1, 2, 2, 1, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  // outward normal (perpendicular to the left edge, pointing up-left)
  const edge = new THREE.Vector2().subVectors(outer.apex, outer.bl).normalize();
  const n = new THREE.Vector3(-edge.y, edge.x, 0);
  const normals = new Float32Array(12);
  for (let i = 0; i < 4; i++) {
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  // recentre to match the centered logo geometry
  geo.translate(0, -(outer.apex.y + outer.bl.y) / 2 + 0.0, 0);
  return geo;
}

/**
 * Rounded-corner 16:9 slab for the works screens (7.946 × 4.470 × 0.195,
 * corner radius 0.05), matching the reference thumbnail screen.
 */
export function buildThumbnailScreenGeometry() {
  const W = 7.9462, H = 4.4698, D = 0.1947, R = 0.05;
  const shape = new THREE.Shape();
  const x = -W / 2, y = -H / 2;
  shape.moveTo(x + R, y);
  shape.lineTo(x + W - R, y);
  shape.quadraticCurveTo(x + W, y, x + W, y + R);
  shape.lineTo(x + W, y + H - R);
  shape.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
  shape.lineTo(x + R, y + H);
  shape.quadraticCurveTo(x, y + H, x, y + H - R);
  shape.lineTo(x, y + R);
  shape.quadraticCurveTo(x, y, x + R, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: D,
    bevelEnabled: false,
    curveSegments: 6,
    steps: 1
  });
  geo.center();
  // planar UVs across the face
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
      (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)
    );
  }
  uv.needsUpdate = true;
  return geo;
}
