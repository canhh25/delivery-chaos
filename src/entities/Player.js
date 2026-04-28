import { Bodies, Body, Composite, world } from '../physics.js';

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.width = 20;
    this.height = 40;
    
    this.body = Bodies.rectangle(x, y, this.width, this.height, {
      frictionAir: 0.1,
      restitution: 0.5,
      label: 'Player'
    });
    
    Composite.add(world, this.body);
    
    const speedLv = game.ui.saveSystem.data.upgrades.speed;
    const brakesLv = game.ui.saveSystem.data.upgrades.brakes;
    
    this.speedMultiplier = 1.0 + (speedLv * 0.15); // Mỗi level +15%
    this.brakeMultiplier = 1.0 + (brakesLv * 0.3); // Mỗi level +30% phanh
    this.weatherSpeedMultiplier = 1.0;
    
    this.fuel = 100;
    
    this.keys = { w: false, a: false, s: false, d: false };
    this.setupInputs();
  }
  
  setupInputs() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
    });
  }
  
  update(dt) {
    if (this.game.state !== 'PLAYING') return;
    
    // Tiêu hao xăng (100% tốn khoảng 3 phút nếu chạy liên tục)
    if (this.keys.w || this.keys.a || this.keys.s || this.keys.d) {
      this.fuel -= 0.6 * (dt / 1000);
    } else {
      this.fuel -= 0.1 * (dt / 1000); // Đứng yên tốn ít xăng hơn
    }
    
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.game.triggerGameOver("HẾT XĂNG! Xe chết máy giữa đường.");
      return;
    }

    // Xử lý nạp xăng tại Trạm Xăng
    let atGasStation = false;
    for (const g of this.game.map.gasStations) {
      const px = this.body.position.x;
      const py = this.body.position.y;
      if (px > g.x && px < g.x + g.w && py > g.y && py < g.y + g.h) {
        atGasStation = true;
        break;
      }
    }
    
    if (atGasStation && this.fuel < 100) {
      const costPerPercent = 100; // 100đ cho 1% xăng
      if (this.game.orderSystem.stats.money >= costPerPercent) {
        this.fuel += 10 * (dt / 1000); // 10% mỗi giây
        this.game.orderSystem.stats.money -= costPerPercent * 10 * (dt / 1000);
        if (this.fuel >= 100) this.fuel = 100;
      } else {
        this.game.ui.showNotification("🚫 Không đủ tiền đổ xăng!", 1000);
      }
    }

    let forceX = 0;
    let forceY = 0;
    
    const moveSpeed = 0.005 * this.speedMultiplier * this.weatherSpeedMultiplier;
    
    // Nếu đi ngược hướng với vận tốc -> kích hoạt phanh
    const isBrakingX = (this.keys.a && this.body.velocity.x > 0.5) || (this.keys.d && this.body.velocity.x < -0.5);
    const isBrakingY = (this.keys.w && this.body.velocity.y > 0.5) || (this.keys.s && this.body.velocity.y < -0.5);
    
    const curMoveX = isBrakingX ? moveSpeed * this.brakeMultiplier : moveSpeed;
    const curMoveY = isBrakingY ? moveSpeed * this.brakeMultiplier : moveSpeed;
    
    if (this.keys.w) forceY -= curMoveY;
    if (this.keys.s) forceY += curMoveY;
    if (this.keys.a) forceX -= curMoveX;
    if (this.keys.d) forceX += curMoveX;
    
    if (forceX !== 0 || forceY !== 0) {
      Body.applyForce(this.body, this.body.position, { x: forceX, y: forceY });
      
      if (Math.abs(this.body.velocity.x) > 0.1 || Math.abs(this.body.velocity.y) > 0.1) {
        const angle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
        Body.setAngle(this.body, angle + Math.PI / 2);
      }
    }
  }
  
  render(ctx) {
    const { x, y } = this.body.position;
    const angle = this.body.angle;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Body
    ctx.fillStyle = '#ff5722';
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    // Helmet
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -5, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Headlight (trong ca tối thì vẽ sáng hơn)
    const shift = this.game.ui.saveSystem.data.shift;
    const isEvening = (shift % 3 === 0); // Ca 3, 6, 9...
    
    if (isEvening) {
      ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, -this.height / 2);
      ctx.lineTo(-80, -this.height / 2 - 250);
      ctx.lineTo(80, -this.height / 2 - 250);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 200, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, -this.height / 2);
      ctx.lineTo(-40, -this.height / 2 - 120);
      ctx.lineTo(40, -this.height / 2 - 120);
      ctx.fill();
    }
    
    ctx.restore();
  }
}
