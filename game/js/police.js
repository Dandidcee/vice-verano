import * as THREE from 'three';
import {createVehicle} from './vehicles.js';

const SEARCH_RADIUS = 120;
const ESCAPE_TIME = 12;
const CRIME_HEAT = {carjack: 1, pedestrian: 1, gunshot: 1, explosion: 2};

function shortestAngle(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function makeOfficer(scene, position) {
  const object = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .8, 3, 6), new THREE.MeshLambertMaterial({color: 0x192d47}));
  body.position.y = .8;
  object.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .12, 8), new THREE.MeshLambertMaterial({color: 0x0f1827}));
  cap.position.y = 1.35;
  object.add(cap);
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(.09, .09, .65), new THREE.MeshLambertMaterial({color: 0x15181e}));
  weapon.position.set(0, .82, .42);
  object.add(weapon);
  object.position.copy(position);
  object.visible = false;
  scene.add(object);
  return {object, health: 100, shoot: 0, alive: true, deployed: false, vehicle: null};
}

/** Wanted system: crime heat, off-screen patrol spawning, pursuit, officer disembark and cooldown. */
export function createPolice(scene, world) {
  const cruisers = [];
  const cops = [];
  let heat = 0;
  let escapeTimer = 0;
  let gameRef = null;

  function playerPosition() { return gameRef?.player?.inCar?.position || gameRef?.player?.object?.position || new THREE.Vector3(); }
  function clearUnits() {
    for (const cruiser of cruisers) scene.remove(cruiser.group);
    for (const cop of cops) scene.remove(cop.object);
    cruisers.length = 0;
    cops.length = 0;
  }
  function spawn() {
    const target = playerPosition();
    const angle = Math.random() * Math.PI * 2;
    const distance = 112 + Math.random() * 35;
    const position = new THREE.Vector3(target.x + Math.cos(angle) * distance, 0, target.z + Math.sin(angle) * distance);
    const type = Math.ceil(heat) >= 3 ? 'Interceptor' : 'Patrulla';
    const cruiser = createVehicle(scene, type, position.x, position.z, angle + Math.PI, true);
    cruiser.ai = false;
    cruiser.police = true;
    cruiser.speed = 0;
    cruiser.officer = null;
    cruiser.sirenTime = 0;
    cruiser.priority = cruisers.length % 4;
    cruisers.push(cruiser);
    const officer = makeOfficer(scene, position);
    officer.vehicle = cruiser;
    cruiser.officer = officer;
    cops.push(officer);
  }
  function deployOfficer(cruiser) {
    const officer = cruiser.officer;
    if (!officer || officer.deployed) return;
    officer.deployed = true;
    officer.object.visible = true;
    officer.object.position.copy(cruiser.position);
    officer.object.position.x += Math.cos(cruiser.yaw) * 2.1;
    officer.object.position.z -= Math.sin(cruiser.yaw) * 2.1;
    cruiser.stopped = true;
    cruiser.speed = 0;
  }
  function damagePlayer(player, amount) {
    player.damageTimer = 0;
    const armourDamage = Math.min(player.armour, amount * .65);
    player.armour -= armourDamage;
    player.health = Math.max(0, player.health - (amount - armourDamage));
    if (player.health <= 0 && gameRef) { gameRef.endState = 'wasted'; gameRef.terminalMessage = 'The city swallowed Rico. The city always collects.'; }
  }
  function crime(kind) {
    heat = Math.min(5, heat + (CRIME_HEAT[kind] || 0));
    escapeTimer = 0;
    if (gameRef) gameRef.lastCrime = kind;
  }
  function addWanted(amount) { heat = Math.min(5, Math.max(0, heat + amount)); escapeTimer = 0; }
  function updateOfficer(officer, player, dt) {
    if (!officer.deployed || !officer.alive) return;
    const target = player.inCar ? player.inCar.position : player.object.position;
    const distance = officer.object.position.distanceTo(target);
    const direction = target.clone().sub(officer.object.position).setY(0);
    if (direction.lengthSq() > .1) { officer.object.lookAt(target.x, .8, target.z); officer.object.position.addScaledVector(direction.normalize(), Math.min(3.4 * dt, distance)); }
    officer.shoot -= dt;
    if (distance < 24 && officer.shoot <= 0 && !player.inCar) {
      officer.shoot = 1.15;
      if (gameRef?.combat?.damagePlayer) gameRef.combat.damagePlayer(player, 8);
      else damagePlayer(player, 8);
      gameRef?.audio?.sirens();
    }
    if (distance < 3 && !player.inCar && player.health > 0 && gameRef) { gameRef.endState = 'busted'; gameRef.terminalMessage = 'Inspector Marlow’s officers put Rico in cuffs.'; }
  }

  const api = {
    cruisers,
    cops,
    searchRadius: SEARCH_RADIUS,
    get level() { return Math.ceil(heat); },
    set level(value) { heat = Math.max(0, Math.min(5, value)); escapeTimer = 0; },
    get heat() { return heat; },
    get cooldown() { return Math.min(100, escapeTimer / ESCAPE_TIME * 100); },
    setGame(game) { gameRef = game; },
    addWanted,
    crime,
    damagePlayer,
    update(dt, player) {
      const target = player.inCar ? player.inCar.position : player.object.position;
      if (heat > 0 && cruisers.length < Math.min(5, Math.ceil(heat) + 1)) spawn();
      let close = false;
      for (const cruiser of cruisers) {
        const distance = cruiser.position.distanceTo(target);
        if (distance < SEARCH_RADIUS) close = true;
        if (!cruiser.officer?.deployed) {
          const desiredYaw = Math.atan2(target.x - cruiser.position.x, target.z - cruiser.position.z);
          cruiser.yaw += shortestAngle(cruiser.yaw, desiredYaw) * Math.min(1, dt * 2.8);
          cruiser.group.rotation.y = cruiser.yaw;
          const approachSpeed = distance < 34 ? Math.max(3, distance * .55) : cruiser.maxSpeed;
          cruiser.speed += (Math.min(cruiser.maxSpeed, approachSpeed) - cruiser.speed) * Math.min(1, dt * 3.5);
          cruiser.position.x += Math.sin(cruiser.yaw) * cruiser.speed * dt;
          cruiser.position.z += Math.cos(cruiser.yaw) * cruiser.speed * dt;
          cruiser.sirenTime += dt;
          if (cruiser.sirenTime > 1.2) { gameRef?.audio?.sirens(); cruiser.sirenTime = 0; }
          if (distance < 13 && Math.abs(cruiser.speed) < 12) deployOfficer(cruiser);
          if (distance < 6 && player.inCar) { player.inCar.damage = Math.min(100, player.inCar.damage + 3 * dt); player.inCar.speed *= .97; }
        } else {
          cruiser.speed *= Math.max(0, 1 - dt * 5);
        }
        if (cruiser.officer) updateOfficer(cruiser.officer, player, dt);
      }
      if (!close && heat > 0) {
        escapeTimer += dt;
        if (escapeTimer >= ESCAPE_TIME) heat = Math.max(0, heat - dt * .45);
      } else if (close) escapeTimer = 0;
      if (heat <= 0 && cruisers.length) clearUnits();
    },
    reset() { clearUnits(); heat = 0; escapeTimer = 0; },
  };
  return api;
}
