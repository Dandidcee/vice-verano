import * as THREE from 'three';
import {createVehicle} from './vehicles.js';

const TRAFFIC_TYPES = ['Brisa', 'Marea', 'Viento', 'Toro', 'Camion'];

function placeOnEdge(vehicle, edge, distance) {
  const ratio = distance / edge.length;
  vehicle.position.lerpVectors(edge.from.position, edge.to.position, ratio);
  vehicle.yaw = Math.atan2(edge.to.position.x - edge.from.position.x, edge.to.position.z - edge.from.position.z);
  vehicle.group.rotation.y = vehicle.yaw;
}

/** Spawn lane-following cars from the shared road graph and advance them edge by edge. */
export function createTraffic(scene, world) {
  const vehicles = [];
  const forwardEdges = world.roads.edges;
  for (let i = 0; i < 22; i += 1) {
    const edge = forwardEdges[i % forwardEdges.length];
    const vehicle = createVehicle(scene, TRAFFIC_TYPES[i % TRAFFIC_TYPES.length], 0, 0, 0);
    vehicle.ai = true;
    vehicle.edge = edge;
    vehicle.distanceOnEdge = (i % 5) * 13;
    vehicle.routeSpeed = 10 + (i % 5) * 3;
    placeOnEdge(vehicle, edge, vehicle.distanceOnEdge);
    vehicles.push(vehicle);
  }
  return {
    vehicles,
    update(dt, player, police) {
      for (const vehicle of vehicles) {
        if (vehicle.occupied || !vehicle.ai) continue;
        vehicle.distanceOnEdge += vehicle.routeSpeed * dt;
        while (vehicle.distanceOnEdge >= vehicle.edge.length) {
          vehicle.distanceOnEdge -= vehicle.edge.length;
          const choices = vehicle.edge.to.edges.filter((candidate) => candidate.to !== vehicle.edge.from);
          vehicle.edge = choices[(vehicle.edge.to.id + vehicles.indexOf(vehicle)) % choices.length] || vehicle.edge;
        }
        placeOnEdge(vehicle, vehicle.edge, vehicle.distanceOnEdge);
        vehicle.speed = vehicle.routeSpeed;
        if (player.inCar && vehicle.position.distanceTo(player.inCar.position) < 3) {
          player.inCar.speed *= .86;
          police.addWanted(.15);
        }
      }
    },
  };
}
