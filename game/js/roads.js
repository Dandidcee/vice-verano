import * as THREE from 'three';
import {CITY,PALETTE} from './config.js';
export function createRoadNetwork(scene){
 const group=new THREE.Group(), lines=[];const xs=[];for(let x=-360;x<=360;x+=90)xs.push(x);const zs=[];for(let z=-270;z<=270;z+=90)zs.push(z);
 const mat=new THREE.MeshLambertMaterial({color:PALETTE.asphalt}), curb=new THREE.MeshLambertMaterial({color:PALETTE.kerb});
 for(const x of xs){const r=new THREE.Mesh(new THREE.BoxGeometry(CITY.road,.08,600),mat);r.position.set(x,.04,0);group.add(r);const c1=new THREE.Mesh(new THREE.BoxGeometry(2,.14,600),curb);c1.position.set(x-11,.09,0);group.add(c1);const c2=c1.clone();c2.position.x=x+11;group.add(c2);lines.push({x,z:null,axis:'z'})}
 for(const z of zs){const r=new THREE.Mesh(new THREE.BoxGeometry(760,.08,CITY.road),mat);r.position.set(0,.04,z);group.add(r);const c1=new THREE.Mesh(new THREE.BoxGeometry(760,.14,2),curb);c1.position.set(0,.09,z-11);group.add(c1);const c2=c1.clone();c2.position.z=z+11;group.add(c2);lines.push({z,x:null,axis:'x'})}
 scene.add(group);return {group,xs,zs,points:lines,randomPoint(i=0){const x=xs[i%xs.length],z=zs[(i*3+1)%zs.length];return new THREE.Vector3(x,.2,z)}};
}
