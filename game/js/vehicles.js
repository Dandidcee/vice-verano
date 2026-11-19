import * as THREE from 'three';
import {VEHICLE_TYPES,clamp} from './config.js';
const mat=c=>new THREE.MeshLambertMaterial({color:c});
export function createVehicle(scene,type='Brisa',x=0,z=0,yaw=0,police=false){
 const spec=VEHICLE_TYPES[type]||VEHICLE_TYPES.Brisa,g=new THREE.Group();g.name=type;const body=new THREE.Mesh(new THREE.BoxGeometry(type==='Camion'?2.35:1.9,.72,type==='Camion'?5:3.8),mat(spec.color));body.position.y=1;g.add(body);const roof=new THREE.Mesh(new THREE.BoxGeometry(type==='Camion'?2.05:1.65,.55,type==='Camion'?2.2:1.8),mat(police?0x263b51:spec.color));roof.position.y=1.55;g.add(roof);
 const glass=new THREE.Mesh(new THREE.BoxGeometry(1.55,.3,1.5),new THREE.MeshBasicMaterial({color:0x183847,transparent:true,opacity:.78}));glass.position.set(0,1.72,.15);g.add(glass);for(const side of [-1,1])for(const zoff of [-1.25,1.25]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.18,12),mat(0x20242b));w.rotation.z=Math.PI/2;w.position.set(side*1.02,.55,zoff);g.add(w)}
 if(police){const bar=new THREE.Mesh(new THREE.BoxGeometry(1.25,.16,.25),mat(0xf05e70));bar.position.y=2;g.add(bar)}scene.add(g);g.position.set(x,0,z);g.rotation.y=yaw;
 return {group:g,type,police,position:g.position,yaw,speed:0,velocity:new THREE.Vector3(),ai:true,health:100,maxSpeed:spec.max,accel:spec.accel,occupied:false,stopped:false,damage:0};
}
export function updateVehiclePhysics(v,input,world,dt){
 const throttle=input.forward,steer=input.steer,brake=input.brake;const grip=brake?.35:.9;v.speed+=throttle*v.accel*dt;if(brake)v.speed*=Math.max(0,1-13*dt);v.speed=clamp(v.speed,-10,v.maxSpeed);v.yaw-=steer*(.9+Math.abs(v.speed)/v.maxSpeed)*dt*(v.speed>=0?1:-1);v.group.rotation.y=v.yaw;const old=v.position.clone();v.position.x+=Math.sin(v.yaw)*v.speed*dt;v.position.z+=Math.cos(v.yaw)*v.speed*dt;v.velocity.set(Math.sin(v.yaw)*v.speed,0,Math.cos(v.yaw)*v.speed);if(world.insideBuilding(v.position)||Math.abs(v.position.x)>410||Math.abs(v.position.z)>365){v.position.copy(old);v.speed*=-.15;v.damage=Math.min(100,v.damage+8)}v.speed*=1-(1-grip)*.08;return v;
}
export function nearestVehicle(vehicles,pos,range=7){let found=null,best=range;for(const v of vehicles){if(v.occupied||v.police)continue;const d=v.position.distanceTo(pos);if(d<best){best=d;found=v}}return found}
export function enterVehicle(v,player){v.occupied=true;player.inCar=v;player.object.visible=false;player.object.position.copy(v.position);player.object.position.y=0;}
export function exitVehicle(v,player){v.occupied=false;player.inCar=null;player.object.visible=true;player.object.position.copy(v.position);player.object.position.x+=Math.cos(v.yaw)*3;player.object.position.z-=Math.sin(v.yaw)*3;v.speed*=.5;}
