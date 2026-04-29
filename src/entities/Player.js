import { Bodies, Body, Composite, world } from '../physics.js';
import { Sfx } from '../audio.js';

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

    // 1. TIÊU HAO XĂNG
    // Chỉ trừ xăng khi có nhấn phím di chuyển (w, a, s, d)
    if (this.keys.w || this.keys.a || this.keys.s || this.keys.d) {
        this.fuel -= 0.6 * (dt / 1000); 
    } 
    // Không có else -> Đứng yên không trừ xăng

    // Kiểm tra hết xăng
    if (this.fuel <= 0) {
        this.fuel = 0;
        Sfx.engineOff();
        this.game.triggerGameOver("HẾT XĂNG! Xe chết máy giữa đường.");
        return;
    }

    // 2. XỬ LÝ NẠP XĂNG (Đổ đầy ngay - Trừ tiền một lần)
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
        const costPerPercent = 100;
        const fuelNeeded = 100 - this.fuel; // Lượng xăng thực tế cần bù cho đầy
        const totalCost = fuelNeeded * costPerPercent;

        if (this.game.orderSystem.stats.money >= totalCost) {
            // Thực hiện nạp đầy và trừ tiền NGAY LẬP TỨC
            this.fuel = 100;
            this.game.orderSystem.stats.money -= totalCost;

            // Thông báo một lần
            this.game.ui.showNotification(`⛽ Đã nạp đầy bình! -${Math.round(totalCost).toLocaleString()}đ`, 2000);
        } else {
            // Nếu không đủ tiền nạp đầy, chỉ thông báo 1 lần khi chạm vào
            if (Math.random() < 0.02) { 
                this.game.ui.showNotification("🚫 Không đủ tiền để nạp đầy bình!", 1000);
            }
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

    // 3. Âm thanh tiếng xe tăng tốc (engine) - phát theo tốc độ khi người chơi đang nhấn WASD
    const movingInput = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
    const v = this.body.velocity;
    const speed = Math.hypot(v.x, v.y);

    if (movingInput && speed > 0.12) {
      Sfx.engineOn();
      Sfx.engineUpdate(speed);
    } else {
      Sfx.engineOff();
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
