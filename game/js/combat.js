import * as THREE from 'three';

export const WEAPONS = {
  pistol: {name: 'PISTOL', magazine: 12, reserve: 48, delay: .22, pellets: 1, spread: .006, damage: 42, range: 90},
  shotgun: {name: 'SHOTGUN', magazine: 6, reserve: 24, delay: .78, pellets: 7, spread: .075, damage: 18, range: 58},
};

function directionWithSpread(direction, spread, pellet) {
  const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  return direction.clone().addScaledVector(right, Math.sin(pellet * 13.7) * spread).addScaledVector(up, Math.cos(pellet * 9.1) * spread).normalize();
}

function addTracer(scene, from, to, tracers) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({color: 0xffe29a, transparent: true, opacity: .9}));
  scene.add(line);
  tracers.push({object: line, time: .055});
}

function addSparks(scene, position, sparks) {
  const points = [];
  for (let index = 0; index < 4; index += 1) {
    const end = position.clone().add(new THREE.Vector3(Math.sin(index * 7) * .45, .15 + index * .08, Math.cos(index * 5) * .45));
    points.push(position.clone(), end);
  }
  const spark = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: 0xffc65d, transparent: true, opacity: 1}));
  scene.add(spark);
  sparks.push({object: spark, time: .18});
}

function addMuzzleFlash(scene, from, direction, flashes) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(.16, 6, 4), new THREE.MeshBasicMaterial({color: 0xffd37a}));
  flash.position.copy(from).addScaledVector(direction, .42);
  scene.add(flash);
  flashes.push({object: flash, time: .07});
}

/** Pistol and shotgun combat: aiming, ray traces, sparks, tracers, damage and regeneration. */
export function createCombat(scene, audio, police, peds) {
  let cooldown = 0;
  let weaponKey = 'pistol';
  let aimingState = false;
  let vehicles = [];
  const tracers = [], sparks = [], flashes = [];
  const raycaster = new THREE.Raycaster();

  function ensureLoadout(player) {
    if (!player.loadout) player.loadout = {pistol: {ammo: 12, reserve: 48}, shotgun: {ammo: 6, reserve: 24}};
    player.weapon = weaponKey;
    player.ammo = player.loadout[weaponKey].ammo;
    player.reserveAmmo = player.loadout[weaponKey].reserve;
  }
  function switchWeapon(player) {
    weaponKey = weaponKey === 'pistol' ? 'shotgun' : 'pistol';
    ensureLoadout(player);
    audio.pickup();
  }
  function damagePlayer(player, amount) {
    ensureLoadout(player);
    player.damageTimer = 0;
    const armourDamage = Math.min(player.armour, amount * .65);
    player.armour -= armourDamage;
    player.health = Math.max(0, player.health - (amount - armourDamage));
    if (player.health <= 0) { player.health = 0; player.endState = 'wasted'; }
  }
  function nearestTarget(from, direction, range, damage, player) {
    let target = null;
    let distance = range;
    const candidates = [...peds.peds, ...police.cops];
    for (const candidate of candidates) {
      if (candidate.alive === false || candidate.object.visible === false) continue;
      const position = candidate.object.getWorldPosition(new THREE.Vector3());
      const along = position.clone().sub(from).dot(direction);
      const perpendicular = position.distanceTo(from.clone().addScaledVector(direction, Math.max(0, along)));
      if (along > 0 && along < distance && perpendicular < 1.5) { target = candidate; distance = along; }
    }
    for (const vehicle of vehicles) {
      if (!vehicle.group.visible || vehicle === player.inCar) continue;
      const position = vehicle.position;
      const along = position.clone().sub(from).dot(direction);
      const perpendicular = position.distanceTo(from.clone().addScaledVector(direction, Math.max(0, along)));
      if (along > 0 && along < distance && perpendicular < Math.max(1.3, vehicle.width)) { target = vehicle; distance = along; }
    }
    if (target) {
      if (target.position && target.group && target.type) {
        target.damage = (target.damage || 0) + damage;
        if (target.damage >= 100) {
          target.group.visible = false;
          target.exploded = true;
          police.crime('explosion');
        }
      } else {
        target.health -= damage;
        target.object.rotation.z += .18;
        if (target.health <= 0) { target.alive = false; target.object.rotation.z = -1.3; player.money += 50; }
      }
    }
    return {target, distance};
  }
  function fire(player, camera) {
    ensureLoadout(player);
    const spec = WEAPONS[weaponKey];
    const load = player.loadout[weaponKey];
    if (cooldown > 0 || player.inCar || load.ammo <= 0) return false;
    cooldown = spec.delay;
    load.ammo -= 1;
    player.ammo = load.ammo;
    player.gunshotPulse = .45;
    player.gunshotPosition = player.object.position.clone();
    police.crime('gunshot');
    audio.gun();
    const from = camera.getWorldPosition(new THREE.Vector3());
    const baseDirection = camera.getWorldDirection(new THREE.Vector3());
    addMuzzleFlash(scene, from, baseDirection, flashes);
    for (let pellet = 0; pellet < spec.pellets; pellet += 1) {
      const direction = directionWithSpread(baseDirection, spec.spread, pellet);
      raycaster.set(from, direction);
      raycaster.far = spec.range;
      const intersections = raycaster.intersectObjects(scene.children, true).filter((hit) => hit.object !== camera && !hit.object.userData?.transient);
      const environmentDistance = intersections.length ? intersections[0].distance : spec.range;
      const result = nearestTarget(from, direction, environmentDistance, spec.damage, player);
      const hitPoint = from.clone().addScaledVector(direction, result.target ? result.distance : environmentDistance);
      addTracer(scene, from, hitPoint, tracers);
      addSparks(scene, hitPoint, sparks);
    }
    return true;
  }
  function update(dt, input, player, camera) {
    ensureLoadout(player);
    cooldown = Math.max(0, cooldown - dt);
    aimingState = Boolean(input.mouse.right);
    player.aiming = aimingState;
    player.gunshotPulse = Math.max(0, (player.gunshotPulse || 0) - dt);
    player.damageTimer = (player.damageTimer || 0) + dt;
    if (player.damageTimer > 4 && player.health > 0) player.health = Math.min(100, player.health + dt * 3.2);
    if (player.damageTimer > 6 && player.armour > 0) player.armour = Math.min(50, player.armour + dt * 2.2);
    if (input.consume('KeyQ')) switchWeapon(player);
    if (input.mouse.left) fire(player, camera);
    for (const collection of [tracers, sparks, flashes]) for (let index = collection.length - 1; index >= 0; index -= 1) { collection[index].time -= dt; if (collection[index].time <= 0) { scene.remove(collection[index].object); collection.splice(index, 1); } }
    player.ammo = player.loadout[weaponKey].ammo;
    player.reserveAmmo = player.loadout[weaponKey].reserve;
  }
  return {
    update,
    fire,
    damagePlayer,
    setVehicles(nextVehicles) { vehicles = nextVehicles; },
    giveAmmo(player, amount = 12) { ensureLoadout(player); player.loadout[weaponKey].reserve += amount; },
    reset(player) { weaponKey = 'pistol'; aimingState = false; player.loadout = {pistol: {ammo: 12, reserve: 48}, shotgun: {ammo: 6, reserve: 24}}; ensureLoadout(player); },
    get weapon() { return weaponKey; },
    get aiming() { return aimingState; },
  };
}
