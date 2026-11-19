import * as THREE from 'three';
import {CITY, DISTRICTS, PALETTE} from './config.js';
import {createRoadNetwork} from './roads.js';

const material = (color) => new THREE.MeshLambertMaterial({color});

function addBox(group, x, y, z, width, height, depth, color, collisions) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
  mesh.position.set(x, y + height / 2, z);
  group.add(mesh);
  if (collisions) collisions.push({x, z, w: width, d: depth});
  return mesh;
}

function writeInstance(mesh, index, position, scale, rotation, dummy) {
  dummy.position.copy(position);
  dummy.scale.copy(scale);
  dummy.rotation.set(rotation.x, rotation.y, rotation.z);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function addRepeatedCityDetails(scene, windows, lamps, palms) {
  const dummy = new THREE.Object3D();
  const windowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0xdaf4e8}), windows.length);
  windows.forEach((window, index) => {
    writeInstance(windowMesh, index, new THREE.Vector3(window.x, window.y, window.z), new THREE.Vector3(window.w, window.h, window.d), new THREE.Euler(), dummy);
  });
  scene.add(windowMesh);

  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .17, 6, 6), material(0x343a42), lamps.length);
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.35, 6, 5), new THREE.MeshBasicMaterial({color: 0xffe4a3}), lamps.length);
  lamps.forEach((lamp, index) => {
    writeInstance(poleMesh, index, new THREE.Vector3(lamp.x, 3, lamp.z), new THREE.Vector3(1, 1, 1), new THREE.Euler(), dummy);
    writeInstance(bulbMesh, index, new THREE.Vector3(lamp.x, 6, lamp.z), new THREE.Vector3(1, 1, 1), new THREE.Euler(), dummy);
  });
  scene.add(poleMesh, bulbMesh);

  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.5, .75, 7, 6), material(0x9b6d4a), palms.length);
  const frondMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(.28, 4.6, 5), material(PALETTE.palm), palms.length * 4);
  palms.forEach((palm, index) => {
    writeInstance(trunkMesh, index, new THREE.Vector3(palm.x, 3.5 * palm.scale, palm.z), new THREE.Vector3(palm.scale, palm.scale, palm.scale), new THREE.Euler(), dummy);
    for (let frond = 0; frond < 4; frond += 1) {
      writeInstance(frondMesh, index * 4 + frond, new THREE.Vector3(palm.x, 7 * palm.scale, palm.z), new THREE.Vector3(palm.scale, palm.scale, palm.scale), new THREE.Euler(0, frond * Math.PI / 2, Math.PI / 2.8), dummy);
    }
  });
  scene.add(trunkMesh, frondMesh);
}

/** Build Vice Verano's nine-by-nine coastal city from instanced repeated details. */
export function createWorld(scene) {
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0xd9c4a2, 420, 1050);
  scene.add(new THREE.HemisphereLight(0xafe6ef, 0xc58c65, 1.7));
  const sun = new THREE.DirectionalLight(0xffd2a1, 3.2);
  sun.position.set(-260, 360, -300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), material(PALETTE.sand));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1500, 240), new THREE.MeshLambertMaterial({color: PALETTE.sea, transparent: true, opacity: .92}));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -.08, -450);
  scene.add(sea);

  const roads = createRoadNetwork(scene);
  const city = new THREE.Group();
  city.name = 'ViceVeranoCity';
  const collisions = [], landmarks = [], shops = [], pickups = [], windows = [], lamps = [], palms = [];
  scene.add(city);

  for (let ix = -4; ix <= 4; ix += 1) for (let iz = -4; iz <= 4; iz += 1) {
    const centerX = ix * 80, centerZ = iz * 80;
    const district = ix < 0 && iz < 0 ? 0 : ix < 0 ? 1 : ix > 1 && iz < 0 ? 3 : 2;
    const buildingCount = 2 + Math.abs(ix + iz) % 2;
    for (let building = 0; building < buildingCount; building += 1) {
      const x = centerX + (building ? (building * 31) % 42 - 21 : 0);
      const z = centerZ + (building ? (building * 47) % 42 - 21 : 0);
      const width = 20 + (building * 7) % 17;
      const depth = 20 + (building * 5) % 17;
      const height = district === 2 ? 28 + (building + ix * 2 + iz) % 4 * 8 : 8 + (building + iz) % 3 * 7;
      addBox(city, x, 0, z, width, height, depth, PALETTE.facades[(ix * 3 + iz + building + 30) % PALETTE.facades.length], collisions);
      for (let row = 0; row < Math.min(5, Math.floor(height / 5)); row += 1) windows.push({x: x - width * .36, y: 2.5 + row * 4, z: z - depth / 2 - .03, w: width * .18, h: .9, d: .08});
      landmarks.push({x, z, name: DISTRICTS[district][0]});
    }
  }
  for (let x = -360; x <= 360; x += 80) { palms.push({x: x + 22, z: -344, scale: .8}); palms.push({x: x - 25, z: 344, scale: .65}); }
  for (let z = -360; z <= 360; z += 80) { palms.push({x: -382, z, scale: .7}); palms.push({x: 382, z, scale: .7}); }
  for (let x = -360; x <= 360; x += 80) for (let z = -360; z <= 360; z += 80) lamps.push({x: x + 14, z: z + 14});
  addRepeatedCityDetails(scene, windows, lamps, palms);

  const shopPoints = [[-320, -280, 'SUNSET SUPPLY'], [320, -280, 'PALM RADIO'], [-320, 280, 'DOCKSIDE LOCKER'], [320, 280, 'MIRAFLORES MART']];
  for (const [x, z, name] of shopPoints) { addBox(city, x, 0, z, 26, 7, 19, 0xe79b74); shops.push({x, z, name}); }
  for (const [x, z, type, color] of [[-180, -270, 'HEALTH', 0x60ef9a], [180, 270, 'ARMOUR', 0x63c9ff]]) { const pickup = addBox(city, x, 0, z, 2, 1.8, 2, color); pickup.material = new THREE.MeshBasicMaterial({color, emissive: color}); pickups.push({x, z, type, mesh: pickup, active: true}); }
  const pier = new THREE.Mesh(new THREE.BoxGeometry(130, 1, 180), material(0x6f574e));
  pier.position.set(-250, .2, -390);
  city.add(pier);
  for (let index = 0; index < 6; index += 1) { addBox(city, -290 + index * 16, .5, -385, 12, 5, 9, [0xd96e59, 0x5a83aa, 0xe9bd6b][index % 3]); landmarks.push({x: -290 + index * 16, z: -385, name: 'HARBORLINE PIER'}); }
  const causeway = new THREE.Mesh(new THREE.BoxGeometry(34, 1, 500), material(0x78838a));
  causeway.position.set(0, 1, 0);
  city.add(causeway);
  for (let z = -240; z <= 240; z += 28) { addBox(city, -18, 4, z, 2, 1, .4, 0xffd063); addBox(city, 18, 4, z, 2, 1, .4, 0xffd063); }

  return {
    roads,
    group: city,
    collisions,
    shops,
    landmarks,
    pickups,
    sea,
    insideBuilding(position) { return collisions.some((building) => position.x > building.x - building.w / 2 && position.x < building.x + building.w / 2 && position.z > building.z - building.d / 2 && position.z < building.z + building.d / 2); },
    districtAt(position) { return position.z < -150 && position.x < 0 ? 'CORAL ROW' : position.x < 0 ? 'HARBORLINE' : position.z < 0 ? 'LITTLE SOMBRA' : 'MIRAFLORES'; },
  };
}
