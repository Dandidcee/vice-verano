import * as THREE from 'three';
export function createPedestrians(scene,world){
 const peds=[];
 for(let i=0;i<38;i++){const g=new THREE.Group(),shirt=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.8,3,6),new THREE.MeshLambertMaterial({color:[0x447b82,0xd27567,0xead184,0x5c6bb0][i%4]}));shirt.position.y=.75;g.add(shirt);const head=new THREE.Mesh(new THREE.SphereGeometry(.2,7,6),new THREE.MeshLambertMaterial({color:0xa66b50}));head.position.y=1.45;g.add(head);const x=((i*47)%680)-340,z=((i*71)%500)-250;g.position.set(x,0,z);scene.add(g);peds.push({object:g,x,z,heading:i%2?0:Math.PI/2,speed:1+(i%3)*.3,health:40,alive:true,walk:i%5!==0});}
 return {peds,update(dt,player){for(const p of peds){if(!p.alive)continue;if(p.object.position.distanceTo(player.object.position)<2.2&&!player.inCar){p.alive=false;p.object.rotation.z=-1.2;player.health=Math.max(0,player.health-8);continue}if(p.walk){p.object.position.x+=Math.sin(p.heading)*p.speed*dt;p.object.position.z+=Math.cos(p.heading)*p.speed*dt;if(Math.abs(p.object.position.x)>370||Math.abs(p.object.position.z)>300)p.heading+=Math.PI}p.object.lookAt(p.object.position.x+Math.sin(p.heading),.8,p.object.position.z+Math.cos(p.heading))}}};
}
