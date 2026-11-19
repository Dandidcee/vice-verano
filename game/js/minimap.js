/** Top-down city radar sourced from the live road graph and world entities. */
export function createMinimap() {
  const canvas = document.getElementById('minimap');
  const context = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const scale = .45;

  function map(worldX, worldZ, player, yaw) {
    const dx = (worldX - player.x) * scale;
    const dz = (worldZ - player.z) * scale;
    const cos = Math.cos(-yaw), sin = Math.sin(-yaw);
    return [center + dx * cos - dz * sin, center + dx * sin + dz * cos];
  }

  function arrow(x, y, angle, color, radius = 5) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, -radius - 2);
    context.lineTo(radius, radius);
    context.lineTo(0, radius * .45);
    context.lineTo(-radius, radius);
    context.closePath();
    context.fill();
    context.restore();
  }

  return {
    draw(game) {
      const player = game.player.inCar?.position || game.player.object.position;
      const yaw = game.player.yaw || 0;
      context.clearRect(0, 0, size, size);
      context.fillStyle = '#18373b';
      context.fillRect(0, 0, size, size);

      context.strokeStyle = '#6c8b86';
      context.lineWidth = 4;
      for (const edge of game.world.roads.edges) {
        const from = map(edge.from.position.x, edge.from.position.z, player, yaw);
        const to = map(edge.to.position.x, edge.to.position.z, player, yaw);
        context.beginPath();
        context.moveTo(...from);
        context.lineTo(...to);
        context.stroke();
      }

      for (const shop of game.world.shops) {
        const point = map(shop.x, shop.z, player, yaw);
        context.fillStyle = '#e9a56a';
        context.fillRect(point[0] - 2, point[1] - 2, 4, 4);
      }

      const waypoint = map(game.missions.waypoint.x, game.missions.waypoint.z, player, yaw);
      context.save();
      context.translate(waypoint[0], waypoint[1]);
      context.rotate(Math.PI / 4);
      context.fillStyle = '#ffd75c';
      context.fillRect(-5, -5, 10, 10);
      context.restore();

      for (const vehicle of game.traffic.vehicles) {
        const point = map(vehicle.position.x, vehicle.position.z, player, yaw);
        if (point[0] < -8 || point[0] > size + 8 || point[1] < -8 || point[1] > size + 8) continue;
        arrow(point[0], point[1], vehicle.yaw - yaw, '#d6e1d3', 3);
      }
      for (const cruiser of game.police.cruisers) {
        const point = map(cruiser.position.x, cruiser.position.z, player, yaw);
        if (point[0] < -8 || point[0] > size + 8 || point[1] < -8 || point[1] > size + 8) continue;
        arrow(point[0], point[1], cruiser.yaw - yaw, '#55a9ff', 5);
      }
      arrow(center, center, 0, '#ffffff', 7);
    },
  };
}
