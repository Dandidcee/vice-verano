export function createInput(canvas){
 const keys=new Set(); const mouse={x:0,y:0,dx:0,dy:0,left:false,right:false};
 addEventListener('keydown',e=>{keys.add(e.code);if(['Space','KeyW','KeyA','KeyS','KeyD','KeyF','KeyM','Escape','ShiftLeft','ShiftRight','Enter'].includes(e.code))e.preventDefault()});
 addEventListener('keyup',e=>keys.delete(e.code)); addEventListener('blur',()=>keys.clear());
 canvas.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){mouse.dx+=e.movementX;mouse.dy+=e.movementY}});
 canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.left=true;if(e.button===2)mouse.right=true;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.()});
 addEventListener('mouseup',e=>{if(e.button===0)mouse.left=false;if(e.button===2)mouse.right=false}); canvas.addEventListener('contextmenu',e=>e.preventDefault());
 return {keys,mouse,down:c=>keys.has(c),pressed:c=>keys.has(c),consume(c){if(keys.has(c)){keys.delete(c);return true}return false},look(){let d={x:mouse.dx,y:mouse.dy};mouse.dx=mouse.dy=0;return d}};
}
