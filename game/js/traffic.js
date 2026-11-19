import * as THREE from 'three';
import {createVehicle} from './vehicles.js';

const TRAFFIC_TYPES = ['Brisa', 'Marea', 'Viento', 'Toro', 'Camion'];
const TRAFFIC_COUNT = 40;
const DESPAWN_DISTANCE = 285;
const INTERSECTION_ZONE = 13;
const FOLLOW_GAP = 10;

function placeOnEdge(vehicle, edge, distance) {
  const ratio = Math.max(0, Math.min(1, distance / edge.length));
  vehicle.position.lerpVectors(edge.from.position, edge.to.position, ratio);
  vehicle.yaw = Math.atan2(edge.to.position.x - edge.from.position.x, edge.to.position.z - edge.from.position.z);
  vehicle.group.rotation.y = vehicle.yaw;
  vehicle.velocity.set(Math.sin(vehicle.yaw) * vehicle.speed, 0, Math.cos(vehicle.yaw) * vehicle.speed);
}

function edgeChoices(vehicle) {
  const options = vehicle.edge.to.edges.filter((candidate) => candidate.to !== vehicle.edge.from);
  return options.length ? options : vehicle.edge.to.edges;
}

function respawnVehicle(vehicle, world, player, index) {
  const candidates = world.roads.edges;
  let selected = candidates[(index * 17 + vehicle.routeSeed) % candidates.length];
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const edge = candidates[(index * 17 + vehicle.routeSeed + attempt) % candidates.length];
    if (edge.from.position.distanceTo(player) > DESPAWN_DISTANCE) { selected = edge; break; }
  }
  vehicle.edge = selected;
  vehicle.distanceOnEdge = (vehicle.routeSeed % 5) * 8;
  vehicle.routeSpeed = 9 + (vehicle.routeSeed % 6) * 2.5;
  vehicle.speed = vehicle.routeSpeed;
  vehicle.damage = 0;
  vehicle.telemetry.crashed = false;
  placeOnEdge(vehicle, selected, vehicle.distanceOnEdge);
}

function reserveIntersection(vehicle, node, reservations, time) {
  const current = reservations.get(node.id);
  if (!current || current.vehicle === vehicle || current.until < time) {
    reservations.set(node.id, {vehicle, priority: vehicle.priority, until: time + .7});
    return true;
  }
  return current.vehicle === vehicle;
}

function hasRightOfWay(vehicle, node, reservations, time) {
  const current = reservations.get(node.id);
  if (current && current.vehicle !== vehicle && current.until >= time) return false;
  for (const other of vehicle._trafficVehicles) {
    if (other === vehicle || !other.edge || other.edge.to !== node || other.distanceOnEdge < other.edge.length - INTERSECTION_ZONE) continue;
    if (other.priority < vehicle.priority) return false;
  }
  return reserveIntersection(vehicle, node, reservations, time);
}

function carAhead(vehicle) {
  let nearest = Infinity;
  for (const other of vehicle._trafficVehicles) {
    if (other === vehicle || other.edge !== vehicle.edge) continue;
    const gap = other.distanceOnEdge - vehicle.distanceOnEdge;
    if (gap > 0 && gap < nearest) nearest = gap;
  }
  return nearest;
}

/** Spawn graph traffic, apply right-of-way and recycle distant cars without changing population. */
export function createTraffic(scene, world) {
  const vehicles = [];
  const reservations = new Map();
  const edges = world.roads.edges;
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const edge = edges[(i * 7) % edges.length];
    const vehicle = createVehicle(scene, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length], 0, 0, 0, false, 'traffic');
    vehicle.ai = true;
    vehicle.edge = edge;
    vehicle.routeSeed = i + 11;
    vehicle.priority = i % 4;
    vehicle.distanceOnEdge = (i % 6) * 9;
    vehicle.routeSpeed = 9 + (i % 6) * 2.5;
    vehicle.speed = vehicle.routeSpeed;
    vehicle._trafficVehicles = vehicles;
    placeOnEdge(vehicle, edge, vehicle.distanceOnEdge);
    vehicles.push(vehicle);
  }
  return {
    vehicles,
    reservations,
    population: TRAFFIC_COUNT,
    update(dt, player, police) {
      const playerPosition = player.inCar ? player.inCar.position : player.object.position;
      const time = performance.now() * .001;
      for (const vehicle of vehicles) {
        if (vehicle.occupied || !vehicle.ai) continue;
        if (vehicle.position.distanceTo(playerPosition) > DESPAWN_DISTANCE) {
          respawnVehicle(vehicle, world, playerPosition, vehicles.indexOf(vehicle));
          continue;
        }
        const nextNode = vehicle.edge.to;
        const distanceToNode = vehicle.edge.length - vehicle.distanceOnEdge;
        const ahead = carAhead(vehicle);
        let desiredSpeed = vehicle.routeSpeed;
        if (ahead < FOLLOW_GAP) desiredSpeed = Math.max(0, (ahead - 2) * 1.5);
        if (distanceToNode < INTERSECTION_ZONE && !hasRightOfWay(vehicle, nextNode, reservations, time)) desiredSpeed = 0;
        vehicle.speed += (desiredSpeed - vehicle.speed) * Math.min(1, dt * 5);
        vehicle.distanceOnEdge += vehicle.speed * dt;
        while (vehicle.distanceOnEdge >= vehicle.edge.length) {
          vehicle.distanceOnEdge -= vehicle.edge.length;
          const choices = edgeChoices(vehicle);
          vehicle.edge = choices[(vehicle.edge.to.id + vehicle.routeSeed) % choices.length] || vehicle.edge;
        }
        placeOnEdge(vehicle, vehicle.edge, vehicle.distanceOnEdge);
        if (player.inCar && vehicle.position.distanceTo(player.inCar.position) < 3) {
          player.inCar.speed *= .86;
          police.addWanted(.15);
        }
      }
      for (const [node, reservation] of reservations) if (reservation.until < time) reservations.delete(node);
    },
  };
}
