const SAVE_KEY = 'vice-verano.afterglow.save';

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Persist the compact gameplay state in the browser only. */
export function saveGame(game) {
  const player = game.player;
  const mission = game.missions;
  const payload = {
    x: player.inCar?.position.x ?? player.object.position.x,
    z: player.inCar?.position.z ?? player.object.position.z,
    money: Math.max(0, Math.floor(game.money)),
    mission: mission.index,
    active: mission.active,
    wanted: game.police.level,
    health: player.health,
    armour: player.armour,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Restore position, money, unlock order, heat and survivability for Continue. */
export function loadGame(game) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const mission = Math.max(0, Math.min(5, Math.floor(numberOr(saved.mission, 0))));
    game.player.inCar = null;
    game.player.object.visible = true;
    game.player.velocity.set(0, 0, 0);
    game.player.object.position.set(numberOr(saved.x, -280), 0, numberOr(saved.z, -250));
    game.money = Math.max(0, numberOr(saved.money, 1240));
    game.missions.index = mission;
    game.missions.active = saved.active !== false;
    game.missions.completed = [];
    game.missions.shops = 0;
    game.missions.dialogue = null;
    game.missions.setWaypoint();
    game.police.reset?.();
    game.police.level = Math.max(0, Math.min(5, Math.floor(numberOr(saved.wanted, 0))));
    game.player.health = Math.max(0, Math.min(100, numberOr(saved.health, 100)));
    game.player.armour = Math.max(0, Math.min(50, numberOr(saved.armour, 50)));
    return true;
  } catch {
    return false;
  }
}
