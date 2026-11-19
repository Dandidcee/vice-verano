import * as THREE from 'three';
import {CITY, PALETTE} from './config.js';

const ROAD_SPACING = 80;
const ROAD_COUNT = 10;

function makeRoadSurface(scene, group, material, x, z, width, depth) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), material);
  road.position.set(x, 0.04, z);
  group.add(road);
  scene.add(group);
}

function addSidewalk(group, x, z, width, depth, material) {
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, depth), material);
  sidewalk.position.set(x, 0.12, z);
  group.add(sidewalk);
}

/** Create the shared lane graph used by traffic, police routes and the minimap. */
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

  for (let iz = 0; iz < ROAD_COUNT; iz += 1) {
    for (let ix = 0; ix < ROAD_COUNT; ix += 1) {
      nodes.push({id: nodeId++, ix, iz, position: new THREE.Vector3(xs[ix], .2, zs[iz]), edges: []});
    }
  }
  for (let iz = 0; iz < ROAD_COUNT; iz += 1) {
    for (let ix = 0; ix < ROAD_COUNT; ix += 1) {
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
  }

  for (const x of xs) {
    makeRoadSurface(scene, group, roadMaterial, x, 0, CITY.road, CITY.depth + 30);
    addSidewalk(group, x - 12, 0, 3, CITY.depth + 30, curbMaterial);
    addSidewalk(group, x + 12, 0, 3, CITY.depth + 30, curbMaterial);
    for (const z of zs) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.35, .015, 8), laneMaterial);
      dash.position.set(x, .1, z - 13);
      group.add(dash);
    }
  }
  for (const z of zs) {
    makeRoadSurface(scene, group, roadMaterial, 0, z, CITY.width + 30, CITY.road);
    addSidewalk(group, 0, z - 12, CITY.width + 30, 3, curbMaterial);
    addSidewalk(group, 0, z + 12, CITY.width + 30, 3, curbMaterial);
    for (const x of xs) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(8, .015, .35), laneMaterial);
      dash.position.set(x - 13, .1, z);
      group.add(dash);
    }
  }
  scene.add(group);

  return {
    group,
    xs,
    zs,
    nodes,
    edges,
    nodeAt(ix, iz) { return nodeAt(ix, iz); },
    nearestNode(position) {
      let closest = nodes[0], distance = Infinity;
      for (const node of nodes) {
        const next = node.position.distanceToSquared(position);
        if (next < distance) { distance = next; closest = node; }
      }
      return closest;
    },
    randomPoint(index = 0) {
      return nodes[Math.abs(index) % nodes.length].position.clone();
    },
  };
}
