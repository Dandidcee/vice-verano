import * as THREE from 'three';
import {CITY, PALETTE} from './config.js';

const ROAD_SPACING = 80;
const ROAD_COUNT = 10;

function put(mesh, index, x, y, z, dummy, rotation = 0) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotation, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function instancedStrip(group, geometry, material, positions, rotation = 0) {
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((position, index) => put(mesh, index, position.x, position.y, position.z, dummy, rotation));
  group.add(mesh);
  return mesh;
}

/** Build the shared lane graph and a batched nine-by-nine road grid. */
export function createRoadNetwork(scene) {
  const group = new THREE.Group();
  const roadMaterial = new THREE.MeshLambertMaterial({color: PALETTE.asphalt});
  const curbMaterial = new THREE.MeshLambertMaterial({color: PALETTE.kerb});
  const laneMaterial = new THREE.MeshBasicMaterial({color: 0xd7b965, transparent: true, opacity: .58});
  const xs = Array.from({length: ROAD_COUNT}, (_, i) => (i - 4.5) * ROAD_SPACING);
  const zs = Array.from({length: ROAD_COUNT}, (_, i) => (i - 4.5) * ROAD_SPACING);
  const nodes = [];
  const edges = [];
  const nodeAt = (ix, iz) => nodes[iz * ROAD_COUNT + ix];
  let nodeId = 0;
  for (let iz = 0; iz < ROAD_COUNT; iz += 1) for (let ix = 0; ix < ROAD_COUNT; ix += 1) nodes.push({id: nodeId++, ix, iz, position: new THREE.Vector3(xs[ix], .2, zs[iz]), edges: []});
  for (let iz = 0; iz < ROAD_COUNT; iz += 1) for (let ix = 0; ix < ROAD_COUNT; ix += 1) {
    const from = nodeAt(ix, iz);
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const nx = ix + dx, nz = iz + dz;
      if (nx >= ROAD_COUNT || nz >= ROAD_COUNT) continue;
      const to = nodeAt(nx, nz);
      const edge = {from, to, length: ROAD_SPACING, axis: dx ? 'x' : 'z'};
      edges.push(edge);
      from.edges.push(edge);
      to.edges.push({from: to, to: from, length: ROAD_SPACING, axis: edge.axis});
    }
  }

  const verticalRoads = xs.map((x) => ({x, y: .04, z: 0}));
  const horizontalRoads = zs.map((z) => ({x: 0, y: .04, z}));
  instancedStrip(group, new THREE.BoxGeometry(CITY.road, .08, CITY.depth + 30), roadMaterial, verticalRoads);
  instancedStrip(group, new THREE.BoxGeometry(CITY.width + 30, .08, CITY.road), roadMaterial, horizontalRoads, 0);
  const verticalSidewalks = xs.flatMap((x) => [{x: x - 12, y: .12, z: 0}, {x: x + 12, y: .12, z: 0}]);
  const horizontalSidewalks = zs.flatMap((z) => [{x: 0, y: .12, z: z - 12}, {x: 0, y: .12, z: z + 12}]);
  instancedStrip(group, new THREE.BoxGeometry(3, .16, CITY.depth + 30), curbMaterial, verticalSidewalks);
  instancedStrip(group, new THREE.BoxGeometry(CITY.width + 30, .16, 3), curbMaterial, horizontalSidewalks);
  const verticalDashes = xs.flatMap((x) => zs.map((z) => ({x, y: .1, z: z - 13})));
  const horizontalDashes = zs.flatMap((z) => xs.map((x) => ({x: x - 13, y: .1, z})));
  instancedStrip(group, new THREE.BoxGeometry(.35, .015, 8), laneMaterial, verticalDashes);
  instancedStrip(group, new THREE.BoxGeometry(8, .015, .35), laneMaterial, horizontalDashes);
  scene.add(group);

  return {
    group, xs, zs, nodes, edges,
    nodeAt(ix, iz) { return nodeAt(ix, iz); },
    nearestNode(position) {
      let closest = nodes[0], distance = Infinity;
      for (const node of nodes) { const next = node.position.distanceToSquared(position); if (next < distance) { distance = next; closest = node; } }
      return closest;
    },
    randomPoint(index = 0) { return nodes[Math.abs(index) % nodes.length].position.clone(); },
  };
}
