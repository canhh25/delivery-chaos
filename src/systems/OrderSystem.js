export class OrderSystem {
  constructor(game) {
    this.game = game;
    this.orders = [null, null, null]; // 3 active slots
    this.pendingPickups = []; // Orders waiting on map
    
    this.shiftLength = 5 * 60; // 5 minutes
    this.shiftTimer = this.shiftLength;
    
    this.stats = {
      money: 0,
      rating: 5.0,
      successfulOrders: 0,
      failedOrders: 0,
      collisions: 0
    };
    
    this.lastDeliveryTime = 0;
    this.comboCount = 0;
    
    this.colors = ['#FF5722', '#9C27B0', '#00BCD4', '#E91E63', '#8BC34A'];
  }
  
  update(dt) {
    if (this.game.state !== 'PLAYING') return;
    
    this.shiftTimer -= dt / 1000;
    if (this.shiftTimer <= 0) {
      this.game.endShift();
      return;
    }
    
    // Maintain 3 pending pickups on map
    while (this.pendingPickups.length < 3) {
      this.spawnPendingOrder();
    }
    
    const px = this.game.player.body.position.x;
    const py = this.game.player.body.position.y;
    
    // Check pickups
    for (let i = this.pendingPickups.length - 1; i >= 0; i--) {
      const p = this.pendingPickups[i];
      const dist = Math.hypot(px - p.pickup.x, py - p.pickup.y);
      if (dist < 40) { // Đã đến điểm lấy hàng
        const emptySlot = this.orders.indexOf(null);
        if (emptySlot !== -1) {
          // Nhận đơn
          this.orders[emptySlot] = p;
          this.pendingPickups.splice(i, 1);
          this.game.ui.showNotification(`📦 Nhận đơn: ${p.customer.name}`);
        } else {
          // Túi đầy
          if (Math.random() < 0.05) this.game.ui.showNotification("🚫 Túi hàng đã đầy (Tối đa 3 đơn)!", 1000);
        }
      }
    }
    
    // Update active orders
    for (let i = 0; i < 3; i++) {
      const order = this.orders[i];
      if (order) {
        order.timer -= dt / 1000;
        if (order.timer <= 0) {
          this.failOrder(i);
        } else {
          // Check dropoff
          const dist = Math.hypot(px - order.dropoff.x, py - order.dropoff.y);
          if (dist < 50) {
            this.completeOrder(i);
          }
        }
      }
    }
    
    this.game.ui.updateHUD();
  }
  
  getRandomRoadPoint() {
    const map = this.game.map;
    if (!map.roads || map.roads.length === 0) return { x: 0, y: 0 };
    const road = map.roads[Math.floor(Math.random() * map.roads.length)];
    let x, y;
    if (road.isHorizontal) {
      x = road.x + Math.random() * road.w;
      y = road.center;
    } else {
      x = road.center;
      y = road.y + Math.random() * road.h;
    }
    return { x, y };
  }
  
  spawnPendingOrder() {
    const pickup = this.getRandomRoadPoint();
    const dropoff = this.getRandomRoadPoint();
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    
    this.pendingPickups.push({
      customer: { name: 'Khách #' + Math.floor(Math.random()*900 + 100) },
      pickup: pickup,
      dropoff: dropoff,
      color: color,
      timer: 120,
      timeLimit: 120,
      baseMoney: 15000 + Math.floor(Math.random() * 10000),
      state: 'DELIVERING' // Khi vào slot thì là delivering
    });
  }
  
  completeOrder(slotIndex) {
    const order = this.orders[slotIndex];
    this.orders[slotIndex] = null;
    this.stats.successfulOrders++;
    
    const now = Date.now();
    let comboMult = 1.0;
    if (now - this.lastDeliveryTime < 15000) { // Combo 15s
      this.comboCount++;
      comboMult = 1.0 + (this.comboCount * 0.5);
    } else {
      this.comboCount = 0;
    }
    this.lastDeliveryTime = now;
    
    // Tính tiền
    const timeRatio = order.timer / order.timeLimit;
    const bonus = timeRatio > 0.5 ? 10000 : 0;
    const earned = Math.floor((order.baseMoney + bonus) * comboMult);
    
    this.stats.money += earned;
    this.updateRating(0.1); // +0.1 sao
    
    let msg = `✅ Giao thành công! +${earned.toLocaleString()}đ`;
    if (this.comboCount > 0) msg = `🔥 COMBO x${comboMult}! +${earned.toLocaleString()}đ`;
    this.game.ui.showNotification(msg, 3000);
  }
  
  failOrder(slotIndex) {
    this.orders[slotIndex] = null;
    this.stats.failedOrders++;
    this.stats.money -= 10000; // Trừ tiền
    this.updateRating(-0.5); // Giảm sao
    this.game.ui.showNotification("❌ Đơn hàng quá hạn! Phạt 10,000đ", 3000);
    this.comboCount = 0;
    
    if (this.stats.rating < 2.0) {
      this.game.triggerGameOver("Bị đuổi việc vì Rating quá thấp (< 2.0)");
    }
  }
  
  updateRating(amount) {
    this.stats.rating += amount;
    if (this.stats.rating > 5.0) this.stats.rating = 5.0;
    if (this.stats.rating < 1.0) this.stats.rating = 1.0;
  }
  
  render(ctx) {
    // Vẽ điểm chờ nhận (Pickup)
    for (const p of this.pendingPickups) {
      this.drawMarker(ctx, p.pickup.x, p.pickup.y, '#FFC107', 'LẤY HÀNG');
    }
    
    // Vẽ điểm giao (Dropoff) của các đơn đang có
    for (const order of this.orders) {
      if (order) {
        this.drawMarker(ctx, order.dropoff.x, order.dropoff.y, order.color, 'GIAO HÀNG');
        this.drawDirectionArrow(ctx, order.dropoff, order.color);
      }
    }
  }
  
  drawMarker(ctx, x, y, color, text) {
    ctx.save();
    ctx.translate(x, y);
    
    // Pulse animation
    const time = Date.now() / 200;
    const scale = 1 + Math.sin(time) * 0.1;
    ctx.scale(scale, scale);
    
    // Draw pin
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -20, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(15, -20);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, -40);
    
    ctx.restore();
  }
  
  drawDirectionArrow(ctx, targetPoint, color) {
    const px = this.game.player.body.position.x;
    const py = this.game.player.body.position.y;
    
    const dx = targetPoint.x - px;
    const dy = targetPoint.y - py;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 300) {
      const angle = Math.atan2(dy, dx);
      const arrowDist = 120;
      
      const ax = px + Math.cos(angle) * arrowDist;
      const ay = py + Math.sin(angle) * arrowDist;
      
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -15);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 15);
      ctx.fill();
      
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.restore();
    }
  }
}
