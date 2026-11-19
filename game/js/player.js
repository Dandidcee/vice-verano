import * as THREE from 'three';
import {clamp} from './config.js';

function makeCapsule() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.45, 1.05, 4, 8), new THREE.MeshLambertMaterial({color: 0x273c50}));
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 10, 8), new THREE.MeshLambertMaterial({color: 0xb8735d}));
  head.position.y = 2;
  group.add(head);
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(.65, .18, .08), new THREE.MeshLambertMaterial({color: 0xe1b56e}));
  jacket.position.set(0, 1.25, .4);
  group.add(jacket);
  return group;
}

/** Rico's on-foot controller: capsule body, sprint, jump and building collision. */
export function createPlayer(scene) {
  const object = makeCapsule();
  scene.add(object);
  return {
    object,
    health: 100,
    armour: 50,
    inCar: null,
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: -0.18,
    grounded: true,
    update(input, world, dt) {
      if (this.inCar) return;
      const direction = new THREE.Vector3(
        (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0),
        0,
        (input.down('KeyS') ? 1 : 0) - (input.down('KeyW') ? 1 : 0),
      );
      if (direction.lengthSq()) {
        direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const speed = input.down('ShiftLeft') || input.down('ShiftRight') ? 8 : 5.2;
        this.velocity.x += (direction.x * speed - this.velocity.x) * Math.min(1, dt * 10);
        this.velocity.z += (direction.z * speed - this.velocity.z) * Math.min(1, dt * 10);
        this.object.rotation.y = this.yaw;
      } else {
        this.velocity.x *= Math.max(0, 1 - dt * 12);
        this.velocity.z *= Math.max(0, 1 - dt * 12);
      }
      if (input.consume('Space') && this.grounded) {
        this.velocity.y = 6.5;
        this.grounded = false;
      }
      this.velocity.y -= 22 * dt;
      const old = this.object.position.clone();
      this.object.position.addScaledVector(this.velocity, dt);
      if (this.object.position.y <= 0) {
        this.object.position.y = 0;
        this.velocity.y = 0;
        this.grounded = true;
      }
      if (world.insideBuilding(this.object.position)) {
        this.object.position.copy(old);
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
      this.object.position.x = clamp(this.object.position.x, -400, 400);
      this.object.position.z = clamp(this.object.position.z, -400, 400);
    },
  };
}

/** Third-person orbit camera with a raycast pull-in when a building blocks the view. */
export function updateOrbitCamera(camera, target, yaw, pitch, distance, obstacles, dt) {
  const focus = target.clone().add(new THREE.Vector3(0, 1.25, 0));
  const offset = new THREE.Vector3(-Math.sin(yaw) * distance, 2.2 + pitch * 2, -Math.cos(yaw) * distance);
  const desired = focus.clone().add(offset);
  const ray = new THREE.Raycaster(focus, desired.clone().sub(focus).normalize(), 0, distance);
  const hits = ray.intersectObjects(obstacles, true);
  if (hits.length && hits[0].distance > .7) desired.copy(focus).add(offset.normalize().multiplyScalar(Math.max(.8, hits[0].distance - .35)));
  camera.position.lerp(desired, 1 - Math.pow(.001, dt));
  camera.lookAt(focus);
}
