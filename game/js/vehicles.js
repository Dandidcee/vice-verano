import * as THREE from 'three';
import {VEHICLE_TYPES, clamp} from './config.js';

const BODY_PLANS = {
  Brisa: {width: 1.85, length: 3.7, cabinWidth: 1.48, cabinLength: 1.7, cabinY: 1.5, cabinHeight: .48, wheel: .32, roof: 'hatch'},
  Marea: {width: 1.95, length: 4.25, cabinWidth: 1.6, cabinLength: 2.05, cabinY: 1.48, cabinHeight: .52, wheel: .34, roof: 'sedan'},
  Viento: {width: 2.02, length: 4.05, cabinWidth: 1.62, cabinLength: 1.6, cabinY: 1.42, cabinHeight: .38, wheel: .35, roof: 'coupe'},
  Toro: {width: 2.2, length: 4.7, cabinWidth: 1.75, cabinLength: 1.9, cabinY: 1.6, cabinHeight: .58, wheel: .4, roof: 'pickup'},
  Camion: {width: 2.35, length: 5, cabinWidth: 2.05, cabinLength: 2.2, cabinY: 1.65, cabinHeight: .62, wheel: .42, roof: 'van'},
  Patrulla: {width: 1.98, length: 4.3, cabinWidth: 1.62, cabinLength: 2.05, cabinY: 1.52, cabinHeight: .54, wheel: .35, roof: 'sedan'},
  Interceptor: {width: 2.02, length: 4.45, cabinWidth: 1.62, cabinLength: 1.8, cabinY: 1.48, cabinHeight: .45, wheel: .37, roof: 'coupe'},
};

const vehicleMaterial = (color) => new THREE.MeshLambertMaterial({color});
const glassMaterial = new THREE.MeshLambertMaterial({color: 0x183847, transparent: true, opacity: .84});
const rubberMaterial = new THREE.MeshLambertMaterial({color: 0x191d25});
const chromeMaterial = new THREE.MeshLambertMaterial({color: 0xd6d6c2});

function addBox(group, geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addWheel(group, x, z, radius) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .2, 12), rubberMaterial);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, radius + .25, z);
  group.add(wheel);
  return wheel;
}

function addDoor(group, side, z, plan, color) {
  const pivot = new THREE.Group();
  const door = addBox(pivot, new THREE.BoxGeometry(.07, .82, plan.roof === 'coupe' ? 1.1 : 1.25), vehicleMaterial(color), new THREE.Vector3(side * (plan.width / 2), 1.04, 0));
  door.rotation.y = side * .015;
  pivot.position.set(0, 0, z);
  group.add(pivot);
  return {pivot, side};
}

function buildVehicleBody(type, plan, color, police) {
  const group = new THREE.Group();
  const doors = [];
  const body = addBox(group, new THREE.BoxGeometry(plan.width, .72, plan.length), vehicleMaterial(color), new THREE.Vector3(0, 1, 0));
  body.castShadow = true;
  const cabinColor = police ? 0x263b51 : color;
  const cabin = addBox(group, new THREE.BoxGeometry(plan.cabinWidth, plan.cabinHeight, plan.cabinLength), vehicleMaterial(cabinColor), new THREE.Vector3(0, plan.cabinY, type === 'Toro' ? -.35 : .1));
  cabin.castShadow = true;
  addBox(group, new THREE.BoxGeometry(plan.cabinWidth * .82, .28, plan.cabinLength * .82), glassMaterial, new THREE.Vector3(0, plan.cabinY + .18, type === 'Camion' ? .2 : .12));
  for (const side of [-1, 1]) for (const z of [-plan.length * .31, plan.length * .31]) addWheel(group, side * plan.width * .52, z, plan.wheel);
  for (const side of [-1, 1]) for (const z of [-plan.length * .14, plan.length * .14]) doors.push(addDoor(group, side, z, plan, color));
  addBox(group, new THREE.BoxGeometry(plan.width * .42, .08, .07), chromeMaterial, new THREE.Vector3(0, .9, plan.length * .505));
  addBox(group, new THREE.BoxGeometry(plan.width * .34, .08, .07), new THREE.MeshBasicMaterial({color: 0xffedb0}), new THREE.Vector3(0, 1.02, plan.length * .505));
  if (type === 'Toro') addBox(group, new THREE.BoxGeometry(plan.width * .88, .12, plan.length * .42), vehicleMaterial(0x6e7d79), new THREE.Vector3(0, 1.18, -plan.length * .18));
  if (type === 'Camion') addBox(group, new THREE.BoxGeometry(plan.width * .9, 1.25, plan.length * .42), vehicleMaterial(color), new THREE.Vector3(0, 1.1, -.85));
  let lightbar = null;
  if (police) {
    lightbar = addBox(group, new THREE.BoxGeometry(1.25, .16, .25), vehicleMaterial(0xf05e70), new THREE.Vector3(0, 2.02, 0));
  }
  return {group, doors, lightbar};
}

/** Create an authored box-and-cylinder car with telemetry and interaction state. */
export function createVehicle(scene, type = 'Brisa', x = 0, z = 0, yaw = 0, police = false) {
  const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.Brisa;
  const plan = BODY_PLANS[type] || BODY_PLANS.Brisa;
  const body = buildVehicleBody(type, plan, spec.color, police);
  const group = body.group;
  group.name = type;
  scene.add(group);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  return {
    group,
    type,
    police,
    position: group.position,
    yaw,
    speed: 0,
    velocity: new THREE.Vector3(),
    ai: true,
    health: 100,
    maxSpeed: spec.max,
    accel: spec.accel,
    width: plan.width,
    length: plan.length,
    radius: Math.max(plan.width, plan.length) * .48,
    occupied: false,
    stopped: false,
    damage: 0,
    doors: body.doors,
    lightbar: body.lightbar,
    interaction: null,
    engineSoundHook: null,
    telemetry: {speed: 0, rpm: 0, lateralSlip: 0, handbrake: false, crashed: false},
  };
}

export function setVehicleEngineSoundHook(vehicle, hook) {
  vehicle.engineSoundHook = typeof hook === 'function' ? hook : null;
}

export function emitVehicleEngineSound(vehicle) {
  if (vehicle.engineSoundHook) vehicle.engineSoundHook(vehicle.telemetry);
}

function vehicleForward(vehicle) { return new THREE.Vector3(Math.sin(vehicle.yaw), 0, Math.cos(vehicle.yaw)); }
function vehicleRight(vehicle) { return new THREE.Vector3(Math.cos(vehicle.yaw), 0, -Math.sin(vehicle.yaw)); }

function animateDoors(vehicle, amount) {
  for (const door of vehicle.doors) door.pivot.rotation.y = door.side * amount;
}

/** Progress the short open-door enter/exit animation without blocking the physics loop. */
export function updateVehicleInteraction(vehicle, dt) {
  if (!vehicle.interaction) return false;
  vehicle.interaction.elapsed += dt;
  const progress = clamp(vehicle.interaction.elapsed / vehicle.interaction.duration, 0, 1);
  const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  const opening = vehicle.interaction.action === 'enter' ? eased : 1 - eased;
  animateDoors(vehicle, opening * .72);
  if (progress >= 1) {
    if (vehicle.interaction.action === 'exit') vehicle.occupied = false;
    vehicle.interaction = null;
    animateDoors(vehicle, 0);
  }
  return true;
}

/** Begin carjacking or exit animation. Completion is handled by updateVehicleInteraction. */
export function enterVehicle(vehicle, player) {
  if (!vehicle || vehicle.police || vehicle.occupied || vehicle.interaction) return false;
  vehicle.occupied = true;
  vehicle.interaction = {action: 'enter', elapsed: 0, duration: .42, player};
  player.inCar = vehicle;
  player.object.visible = false;
  player.object.position.copy(vehicle.position);
  return true;
}

export function exitVehicle(vehicle, player) {
  if (!vehicle || vehicle.interaction) return false;
  vehicle.interaction = {action: 'exit', elapsed: 0, duration: .34, player};
  player.object.visible = true;
  player.object.position.copy(vehicle.position);
  player.object.position.x += Math.cos(vehicle.yaw) * 2.8;
  player.object.position.z -= Math.sin(vehicle.yaw) * 2.8;
  player.inCar = null;
  vehicle.speed *= .45;
  return true;
}

function hitBuilding(vehicle, world) {
  return world.insideBuilding(vehicle.position) || Math.abs(vehicle.position.x) > 405 || Math.abs(vehicle.position.z) > 405;
}

function separateCars(vehicle, others) {
  let collision = false;
  for (const other of others) {
    if (other === vehicle || !other.position || other.interaction?.action === 'enter') continue;
    const dx = vehicle.position.x - other.position.x;
    const dz = vehicle.position.z - other.position.z;
    const minimum = vehicle.radius * .36 + other.radius * .36;
    const distance = Math.hypot(dx, dz);
    if (distance > 0 && distance < minimum) {
      const push = (minimum - distance) * .52;
      vehicle.position.x += dx / distance * push;
      vehicle.position.z += dz / distance * push;
      vehicle.speed *= -.2;
      vehicle.damage = Math.min(100, vehicle.damage + 5);
      collision = true;
    }
  }
  return collision;
}

/** Arcade drivetrain: engine force, braking, lateral grip, drift and building/car collision. */
export function updateVehiclePhysics(vehicle, input, world, dt, otherVehicles = [], onEvent = () => {}) {
  if (vehicle.interaction) {
    vehicle.speed *= Math.max(0, 1 - dt * 4);
    return vehicle;
  }
  const forward = vehicleForward(vehicle);
  const right = vehicleRight(vehicle);
  const longitudinal = vehicle.velocity.dot(forward);
  const lateral = vehicle.velocity.dot(right);
  const handbrake = Boolean(input.brake);
  const engineForce = input.forward * vehicle.accel;
  const brakeForce = handbrake ? 18 : 5;
  let nextLongitudinal = longitudinal + engineForce * dt;
  if (input.forward === 0) nextLongitudinal -= Math.sign(nextLongitudinal) * Math.min(Math.abs(nextLongitudinal), brakeForce * dt);
  nextLongitudinal = clamp(nextLongitudinal, -10, vehicle.maxSpeed);
  const grip = handbrake ? 2.2 : 10.5;
  const nextLateral = lateral + (0 - lateral) * Math.min(1, grip * dt);
  vehicle.velocity.copy(forward).multiplyScalar(nextLongitudinal).addScaledVector(right, nextLateral);
  const steering = input.steer * (0.52 + Math.min(1, Math.abs(nextLongitudinal) / vehicle.maxSpeed) * .72);
  vehicle.yaw -= steering * dt * (nextLongitudinal >= 0 ? 1 : -1);
  vehicle.group.rotation.y = vehicle.yaw;
  const previous = vehicle.position.clone();
  vehicle.position.addScaledVector(vehicle.velocity, dt);
  let crashed = false;
  if (hitBuilding(vehicle, world)) {
    vehicle.position.copy(previous);
    vehicle.velocity.multiplyScalar(-.18);
    vehicle.damage = Math.min(100, vehicle.damage + 8);
    crashed = true;
  }
  if (separateCars(vehicle, otherVehicles)) crashed = true;
  vehicle.speed = vehicle.velocity.dot(forward);
  vehicle.telemetry.speed = Math.abs(vehicle.speed);
  vehicle.telemetry.rpm = clamp(Math.abs(vehicle.speed) / vehicle.maxSpeed, 0, 1);
  vehicle.telemetry.lateralSlip = Math.abs(nextLateral);
  vehicle.telemetry.handbrake = handbrake;
  vehicle.telemetry.crashed = crashed;
  if (crashed) onEvent('crash', vehicle);
  return vehicle;
}

export function nearestVehicle(vehicles, position, range = 7) {
  let found = null;
  let best = range;
  for (const vehicle of vehicles) {
    if (vehicle.occupied || vehicle.police || vehicle.interaction) continue;
    const distance = vehicle.position.distanceTo(position);
    if (distance < best) { best = distance; found = vehicle; }
  }
  return found;
}

/** Vehicle-specific camera: farther and lower at speed, with a deliberately laggy spring. */
export function updateVehicleChaseCamera(camera, vehicle, yawOffset, pitch, obstacles, dt) {
  const yaw = vehicle.yaw + yawOffset;
  const distance = 8.5 + Math.min(4, Math.abs(vehicle.speed) * .08);
  const focus = vehicle.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  const desired = focus.clone().add(new THREE.Vector3(-Math.sin(yaw) * distance, 2.9 + pitch * 2, -Math.cos(yaw) * distance));
  const ray = new THREE.Raycaster(focus, desired.clone().sub(focus).normalize(), 0, distance);
  const hits = ray.intersectObjects(obstacles, true);
  if (hits.length && hits[0].distance > .8) desired.copy(focus).add(desired.sub(focus).normalize().multiplyScalar(Math.max(.8, hits[0].distance - .4)));
  camera.position.lerp(desired, 1 - Math.pow(.0008, dt));
  camera.lookAt(focus.clone().add(vehicleForward(vehicle).multiplyScalar(4 + Math.abs(vehicle.speed) * .08)));
}
