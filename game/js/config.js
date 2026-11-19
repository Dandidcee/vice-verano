export const CITY={width:820,depth:720,road:18,block:72,seaZ:-392,beachZ:-330};
export const PALETTE={sand:0xe8d3b0,sea:0x2fb3c4,asphalt:0x3b3b42,kerb:0xd8d2c4,sky:0xffd9a0,facades:[0xf7c8c0,0xbfe3d0,0xffe9b8,0xc9d9f2,0xe6b7cf,0xd2c8ab],palm:0x3f7d4a,glass:0x83c5d7};
export const DISTRICTS=[['CORAL ROW',-260,-230,0xf7c8c0],['HARBORLINE',-250,190,0xd2c8ab],['MIRAFLORES',150,70,0x83b4c6],['LITTLE SOMBRA',170,-210,0xffe9b8],['THE CAUSEWAY',0,0,0x8dd0cf]];
export const VEHICLE_TYPES={Brisa:{color:0xe66e6c,max:34,accel:22},Marea:{color:0x5a9cc8,max:36,accel:20},Viento:{color:0xf1c75b,max:42,accel:26},Toro:{color:0x67ad76,max:31,accel:18},Camion:{color:0xc7a2cf,max:26,accel:15},Patrulla:{color:0x223b58,max:35,accel:24},Interceptor:{color:0x172b43,max:42,accel:28}};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
