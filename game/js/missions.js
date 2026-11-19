/** Original Vice Verano story: six ordered jobs from three local power brokers. */
export const STORY = [
  {title: 'Boot & Go', giver: 'Nadia Voss', objective: 'Find the Brisa and take it for a ride.', zone: [-280, -255], reward: 500, kind: 'steal', before: 'Rico, you still drive like the city owes you money. Start with a Brisa at Coral Row.', after: 'Clean lift. Tito is going to hate how easy you made that look.'},
  {title: 'Salt Run', giver: 'Tito Bravo', objective: 'Deliver the crate across the Causeway before the tide turns.', zone: [0, 250], reward: 850, kind: 'delivery', before: 'Crate is in the trunk. Causeway, then Harborline. No sightseeing.', after: 'You made the run. The bay kept its secrets.'},
  {title: 'Coral Row Shakedown', giver: 'Nadia Voss', objective: 'Collect from three marked shops in Coral Row.', zone: [-315, -225], reward: 1100, kind: 'shops', before: 'Three little envelopes. Three little doors. Keep the smiles optional.', after: 'The Row paid up. Nadia sounds almost impressed.'},
  {title: 'Heat on Harborline', giver: 'Tito Bravo', objective: 'Chase the Camion and ram it to a stop.', zone: [-250, 210], reward: 1450, kind: 'chase', before: 'A Camion is running hot along the docks. Put your bumper where its future is.', after: 'Harborline is louder now. You made sure of that.'},
  {title: 'The Long Pier', giver: 'Nadia Voss', objective: 'Clear the pier and secure the package.', zone: [-250, -385], reward: 2000, kind: 'shootout', before: 'Pier lights, bad men, one package. Your pistol knows the rhythm.', after: 'Package secured. Rico Salaz is back in the city for real.'},
  {title: "Marlow's Offer", giver: 'Inspector Marlow', objective: 'Escape the four-star pursuit and reach the Causeway.', zone: [0, 240], reward: 5000, kind: 'escape', before: 'Inspector Marlow wants a conversation. His cruisers are the invitation.', after: 'Marlow lost your tail. For tonight, the city is yours.'},
];

function distanceToWaypoint(position, waypoint) {
  return Math.hypot(position.x - waypoint.x, position.z - waypoint.z);
}

function line(text, who) {
  return {text, who};
}

/** Mission state machine with explicit unlock order, dialogue, rewards and objective waypoint. */
export function createMissions() {
  const missions = {
    index: 0,
    shops: 0,
    active: true,
    completed: [],
    dialogue: null,
    waypoint: {x: 0, z: 0},
    get mission() { return STORY[this.index]; },

    setWaypoint() {
      const current = this.mission;
      this.waypoint = {x: current.zone[0], z: current.zone[1]};
    },

    startDialogue(game, entries, done) {
      const normalized = entries.map((entry) => typeof entry === 'string' ? line(entry, this.mission.giver) : entry);
      this.dialogue = {lines: normalized, at: 0, done};
      const first = normalized[0];
      game.ui.dialogue(first.text, first.who);
    },

    advanceDialogue(game) {
      if (!this.dialogue) return;
      this.dialogue.at += 1;
      if (this.dialogue.at >= this.dialogue.lines.length) {
        const done = this.dialogue.done;
        this.dialogue = null;
        game.ui.hideDialogue();
        done?.();
        return;
      }
      const next = this.dialogue.lines[this.dialogue.at];
      game.ui.dialogue(next.text, next.who);
    },

    begin(game) {
      this.active = true;
      this.completed = this.completed.slice(0, this.index);
      this.shops = 0;
      this.setWaypoint();
      this.startDialogue(game, [line(this.mission.before, this.mission.giver)], () => {});
    },

    openPhone(game) {
      if (!this.active || this.dialogue) return;
      this.startDialogue(game, [line(this.mission.before, this.mission.giver)], () => {});
    },

    complete(game) {
      if (!this.active || this.completed[this.index]) return false;
      const finished = this.mission;
      const finishedIndex = this.index;
      this.completed[finishedIndex] = true;
      game.money += finished.reward;
      game.audio.pickup();
      if (finishedIndex >= STORY.length - 1) {
        this.active = false;
        this.startDialogue(game, [line(finished.after, finished.giver)], () => {
          game.ui.flashMessage('STORY COMPLETE // MARLOW IS STILL WATCHING');
        });
        return true;
      }
      this.index = finishedIndex + 1;
      this.shops = 0;
      this.setWaypoint();
      this.startDialogue(game, [line(finished.after, finished.giver), line(this.mission.before, this.mission.giver)], () => {});
      return true;
    },

    update(dt, game) {
      if (!this.active || this.dialogue || this.completed[this.index]) return;
      const current = this.mission;
      const position = game.player.inCar?.position || game.player.object.position;
      const distance = distanceToWaypoint(position, this.waypoint);
      if (current.kind === 'steal' && game.player.inCar) this.complete(game);
      else if (current.kind === 'delivery' && game.player.inCar && distance < 18) this.complete(game);
      else if (current.kind === 'shops' && distance < 24) {
        this.shops += 1;
        const stops = [[315, -225], [-315, 225], [-315, -225]];
        if (this.shops >= stops.length) this.complete(game);
        else this.waypoint = {x: stops[this.shops][0], z: stops[this.shops][1]};
      } else if (current.kind === 'chase' && game.player.inCar && distance < 16 && Math.abs(game.player.inCar.speed) > 5) this.complete(game);
      else if (current.kind === 'shootout' && game.combatKills >= 4) this.complete(game);
      else if (current.kind === 'escape' && game.police.level >= 4 && distance < 25) this.complete(game);
    },

    waypointVector() {
      return this.waypoint;
    },
  };
  missions.setWaypoint();
  return missions;
}
