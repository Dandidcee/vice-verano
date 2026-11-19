import {STORY} from './missions.js';

/** DOM HUD renderer for mission, heat, loadout, speed, vitals and terminal outcomes. */
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const title = $('missionTitle'), objective = $('objective'), stars = $('stars'), heat = $('heatText'), cool = $('coolBar');
  const money = $('money'), weapon = $('weapon'), speed = $('speed'), health = $('healthBar'), armour = $('armourBar'), prompt = $('prompt');
  const dialog = $('dialogue'), line = $('dialogueLine'), speaker = $('speaker'), flash = $('flash');
  const terminal = $('terminal'), terminalTitle = $('terminalTitle'), terminalMessage = $('terminalMessage');
  return {
    update(game) {
      const mission = STORY[game.missions.index];
      title.textContent = mission.title;
      objective.textContent = game.missions.dialogue ? `PHONE // ${mission.giver}` : mission.objective + (mission.kind === 'shops' ? ` (${game.missions.shops}/3)` : '');
      const wanted = game.police.level;
      stars.innerHTML = [0, 1, 2, 3, 4].map((index) => `<span class="${index < wanted ? 'on' : ''}">${index < wanted ? '★' : '☆'}</span>`).join(' ');
      heat.textContent = wanted ? `${wanted} STAR${wanted > 1 ? 'S' : ''}` : 'CLEAR';
      cool.style.width = `${game.police.cooldown}%`;
      money.textContent = '$' + Math.floor(game.money).toLocaleString();
      const player = game.player;
      weapon.style.display = player.inCar ? 'none' : 'block';
      const load = player.loadout?.[player.weapon || 'pistol'];
      weapon.textContent = player.inCar ? '' : `${player.weapon === 'shotgun' ? 'SHOTGUN' : 'PISTOL'}  ${load?.ammo ?? 12} / ${load?.reserve ?? 48}${player.aiming ? '  · AIM' : ''}`;
      speed.style.display = player.inCar ? 'block' : 'none';
      const vehicle = player.inCar;
      const kph = vehicle ? Math.round(vehicle.telemetry.speed * 3.6) : 0;
      speed.innerHTML = vehicle ? `${kph} <small>KM/H</small>` : '';
      speed.dataset.speed = String(kph);
      speed.dataset.rpm = vehicle ? vehicle.telemetry.rpm.toFixed(2) : '0';
      speed.dataset.slip = vehicle ? vehicle.telemetry.lateralSlip.toFixed(2) : '0';
      health.style.width = `${player.health}%`;
      armour.style.width = `${player.armour * 2}%`;
      prompt.style.opacity = game.prompt ? 1 : 0;
      prompt.textContent = game.prompt || '';
    },
    dialogue(text, who) { speaker.textContent = who.toUpperCase(); line.textContent = text; dialog.style.display = 'flex'; },
    hideDialogue() { dialog.style.display = 'none'; },
    flashMessage(text) { prompt.textContent = text; prompt.style.opacity = 1; setTimeout(() => prompt.style.opacity = 0, 2600); },
    damage() { document.body.classList.remove('damage'); void document.body.offsetWidth; document.body.classList.add('damage'); flash.style.opacity = .45; setTimeout(() => flash.style.opacity = 0, 80); },
    showTerminal(kind, message) { terminalTitle.textContent = kind.toUpperCase(); terminalTitle.style.color = kind === 'busted' ? '#ffd56a' : '#ff8790'; terminalMessage.textContent = message; terminal.style.display = 'flex'; },
    hideTerminal() { terminal.style.display = 'none'; },
  };
}
