import * as THREE from 'three';
import {clamp} from './config.js';

const PED_COUNT = 80;
const WALK_COLORS = [0x447b82, 0xd27567, 0xead184, 0x5c6bb0, 0x83a66e, 0xc681aa];
const WALK_SPEEDS = [1.2, 1.45, 1.7, 2.1];

function makeSidewalkPaths(world) {
  const paths = [];
  for (const edge of world.roads.edges) {
    const direction = edge.to.position.clone().sub(edge.from.position).setY(0).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (const sideSign of [-1, 1]) {
      const offset = side.clone().multiplyScalar(sideSign * 13.5);
      paths.push({from: edge.from.position.clone().add(offset), to: edge.to.position.clone().add(offset), length: edge.length, edge});
    }
  }
  return paths;
}

function setPathPosition(pedestrian) {
  const path = pedestrian.path;
  const ratio = pedestrian.direction > 0 ? pedestrian.progress : 1 - pedestrian.progress;
  pedestrian.object.position.lerpVectors(path.from, path.to, ratio);
  const travel = path.to.clone().sub(path.from).multiplyScalar(pedestrian.direction);
  pedestrian.heading = Math.atan2(travel.x, travel.z);
  pedestrian.object.rotation.y = pedestrian.heading;
}

function choosePath(pedestrian, paths, seed) {
  pedestrian.pathIndex = (pedestrian.pathIndex + seed + paths.length) % paths.length;
  pedestrian.path = paths[pedestrian.pathIndex];
  pedestrian.direction = seed % 2 ? 1 : -1;
  pedestrian.progress = seed % 3 === 0 ? .02 : .5;
  setPathPosition(pedestrian);
}

function startFlee(pedestrian, source) {
  const away = pedestrian.object.position.clone().sub(source).setY(0);
  if (away.lengthSq() < .001) away.set(1, 0, 0);
  pedestrian.fleeDirection.copy(away.normalize());
  pedestrian.state = 'flee';
  pedestrian.fleeTimer = 3.5;
  pedestrian.idleTimer = 0;
}

function writeInstance(mesh, index, position, rotation, scale = 1, dummy) {
  dummy.position.copy(position);
  dummy.rotation.set(rotation.x, rotation.y, rotation.z);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

/** Create 80 sidewalk walkers with instanced capsule bodies and animated legs. */
export function createPedestrians(scene, world) {
  const paths = makeSidewalkPaths(world);
  const dummy = new THREE.Object3D();
  const bodyMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.24, .8, 2, 5), new THREE.MeshLambertMaterial({color: 0x447b82}), PED_COUNT);
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.2, 6, 5), new THREE.MeshLambertMaterial({color: 0xb8795d}), PED_COUNT);
  const legMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.09, .55, 2, 4), new THREE.MeshLambertMaterial({color: 0x405066}), PED_COUNT * 2);
  bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  legMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(bodyMesh, headMesh, legMesh);
  const peds = [];
  for (let index = 0; index < PED_COUNT; index += 1) {
    const object = new THREE.Group();
    scene.add(object);
    const pedestrian = {
      object,
      path: paths[index % paths.length],
      pathIndex: index % paths.length,
      progress: (index % 9) / 10,
      direction: index % 2 ? 1 : -1,
      heading: 0,
      speed: WALK_SPEEDS[index % WALK_SPEEDS.length],
      state: index % 7 < 3 ? 'idle' : 'walk',
      idleGroup: Math.floor(index / 4),
      idleTimer: index % 7 < 3 ? 1.5 + (index % 4) * .7 : 0,
      fleeTimer: 0,
      fleeDirection: new THREE.Vector3(),
      health: 40,
      alive: true,
      deadTimer: 0,
      walkPhase: index * .8,
    };
    setPathPosition(pedestrian);
    peds.push(pedestrian);
  }

  function syncInstances() {
    for (let index = 0; index < peds.length; index += 1) {
      const pedestrian = peds[index];
      const visible = pedestrian.alive;
      const bodyPosition = pedestrian.object.position.clone().add(new THREE.Vector3(0, .78, 0));
      const bodyRotation = new THREE.Euler(0, pedestrian.heading, pedestrian.object.rotation.z);
      writeInstance(bodyMesh, index, bodyPosition, bodyRotation, visible ? 1 : 0, dummy);
      const headPosition = pedestrian.object.position.clone().add(new THREE.Vector3(0, 1.48, 0));
      writeInstance(headMesh, index, headPosition, bodyRotation, visible ? 1 : 0, dummy);
      const swing = Math.sin(pedestrian.walkPhase) * (pedestrian.state === 'idle' ? .04 : .28);
      for (const side of [-1, 1]) {
        const local = new THREE.Vector3(side * .13, .35, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), pedestrian.heading);
        const legPosition = pedestrian.object.position.clone().add(local);
        const legRotation = new THREE.Euler(side < 0 ? swing : -swing, pedestrian.heading, pedestrian.object.rotation.z);
        writeInstance(legMesh, index * 2 + (side > 0 ? 1 : 0), legPosition, legRotation, visible ? 1 : 0, dummy);
      }
    }
    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    legMesh.instanceMatrix.needsUpdate = true;
  }

  syncInstances();
  return {
    peds,
    population: PED_COUNT,
    paths,
    update(dt, player, signal = {}) {
      const playerPosition = player.inCar ? player.inCar.position : player.object.position;
      const speedingCars = signal.vehicles || [];
      for (const pedestrian of peds) {
        if (!pedestrian.alive) {
          pedestrian.deadTimer += dt;
          if (pedestrian.deadTimer > 8 && pedestrian.object.position.distanceTo(playerPosition) > 45) {
            pedestrian.alive = true;
            pedestrian.health = 40;
            pedestrian.deadTimer = 0;
            pedestrian.object.rotation.z = 0;
            choosePath(pedestrian, paths, pedestrian.idleGroup + 3);
          }
          continue;
        }
        let danger = null;
        if (signal.gunshot && signal.gunshotPosition && pedestrian.object.position.distanceTo(signal.gunshotPosition) < 90) danger = signal.gunshotPosition;
        if (!danger) for (const vehicle of speedingCars) {
          if (Math.abs(vehicle.speed) > 18 && pedestrian.object.position.distanceTo(vehicle.position) < 16) { danger = vehicle.position; break; }
        }
        if (danger) startFlee(pedestrian, danger);
        const distanceToPlayer = pedestrian.object.position.distanceTo(playerPosition);
        if (player.inCar && Math.abs(player.inCar.speed) > 18 && distanceToPlayer < 1.8) {
          pedestrian.alive = false;
          pedestrian.deadTimer = 0;
          pedestrian.object.rotation.z = -1.15;
          player.health = Math.max(0, player.health - 6);
          continue;
        }
        if (!player.inCar && distanceToPlayer < 1.15) {
          startFlee(pedestrian, playerPosition);
          player.health = Math.max(0, player.health - 1);
        }
        if (pedestrian.state === 'idle') {
          pedestrian.idleTimer -= dt;
          pedestrian.walkPhase += dt * .8;
          if (pedestrian.idleTimer <= 0) pedestrian.state = 'walk';
        } else if (pedestrian.state === 'flee') {
          pedestrian.fleeTimer -= dt;
          pedestrian.object.position.addScaledVector(pedestrian.fleeDirection, dt * 6.2);
          pedestrian.object.position.x = clamp(pedestrian.object.position.x, -405, 405);
          pedestrian.object.position.z = clamp(pedestrian.object.position.z, -405, 405);
          pedestrian.heading = Math.atan2(pedestrian.fleeDirection.x, pedestrian.fleeDirection.z);
          pedestrian.object.rotation.y = pedestrian.heading;
          pedestrian.walkPhase += dt * 11;
          if (pedestrian.fleeTimer <= 0) { pedestrian.state = 'walk'; choosePath(pedestrian, paths, pedestrian.idleGroup + 5); }
        } else {
          pedestrian.progress += pedestrian.speed * dt / pedestrian.path.length;
          pedestrian.walkPhase += dt * (5 + pedestrian.speed);
          if (pedestrian.progress >= 1) choosePath(pedestrian, paths, pedestrian.idleGroup + 1);
          else setPathPosition(pedestrian);
        }
      }
      syncInstances();
    },
  };
}
