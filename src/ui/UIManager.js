import { SaveSystem } from '../systems/SaveSystem.js';
import { initAudio, BGM, Sfx } from '/src/audio.js';
export class UIManager {
  constructor(game) {
    this.game = game;
    this.saveSystem = new SaveSystem();
    
    this.els = {
      mainMenu: document.getElementById('mainMenu'),
      hud: document.getElementById('hud'),
      gameOver: document.getElementById('gameOver'),
      endDay: document.getElementById('endDay'),
      hudMoney: document.getElementById('hudMoney'),
      hudTimer: document.getElementById('hudTimer'),
      hudRating: document.getElementById('hudRating'),
      hudFuel: document.getElementById('hudFuel'),
      ordersContainer: document.getElementById('ordersContainer'),
      notifToast: document.getElementById('notifToast'),
      leaderboardList: document.getElementById('leaderboardList'),
      shopSpeedLv: document.getElementById('shopSpeedLv'),
      shopBrakesLv: document.getElementById('shopBrakesLv'),
      btnUpgradeSpeed: document.getElementById('btnUpgradeSpeed'),
      btnUpgradeBrakes: document.getElementById('btnUpgradeBrakes'),
      endShiftNum: document.getElementById('endShiftNum'),
      endShiftType: document.getElementById('endShiftType')
    };
    
    this.setupEvents();
    this.initMainMenu();
  }
  
  initMainMenu() {
    const list = this.saveSystem.data.leaderboard;
    if (list.length > 0) {
      let html = '';
      list.forEach(entry => {
        html += `<li><span>Ca ${entry.shift} (${entry.date})</span><span class="green">${entry.money.toLocaleString()}đ</span></li>`;
      });
      this.els.leaderboardList.innerHTML = html;
    }
  }

  setupEvents() {
    document.getElementById('btnPlay').addEventListener('click', () => {
      // Kích hoạt hệ thống âm thanh
    initAudio(); 
    // Phát nhạc nền lo-fi
    BGM.start();
    // Tiếng click xác nhận
    Sfx.uiConfirm();
      this.els.mainMenu.classList.add('hidden');
      this.els.hud.classList.remove('hidden');
      this.game.startShift();
    });
    
    document.getElementById('btnNextDay').addEventListener('click', () => {
      this.saveSystem.data.shift++;
      this.saveSystem.data.money = this.game.orderSystem.stats.money;
      this.saveSystem.save();
      location.reload();
    });
    
    document.getElementById('btnRetry').addEventListener('click', () => {
      this.saveSystem.resetProgress();
      location.reload();
    });
    
    document.getElementById('btnMenu').addEventListener('click', () => {
      location.reload();
    });

    this.els.btnUpgradeSpeed.addEventListener('click', () => {
      if (this.saveSystem.buyUpgrade('speed')) {
        this.game.orderSystem.stats.money = this.saveSystem.data.money;
        this.updateShopUI();
      }
    });
    
    this.els.btnUpgradeBrakes.addEventListener('click', () => {
      if (this.saveSystem.buyUpgrade('brakes')) {
        this.game.orderSystem.stats.money = this.saveSystem.data.money;
        this.updateShopUI();
      }
    });
  }
  
  updateHUD() {
    const stats = this.game.orderSystem.stats;
    this.els.hudMoney.innerText = stats.money.toLocaleString() + 'đ';
    this.els.hudRating.innerText = stats.rating.toFixed(1);
    
    const timeRemaining = Math.max(0, this.game.orderSystem.shiftTimer);
    this.els.hudTimer.innerText = this.formatTime(timeRemaining);
    
    this.els.hudFuel.innerText = Math.max(0, Math.floor(this.game.player.fuel)) + '%';
    if (this.game.player.fuel < 20) this.els.hudFuel.style.color = '#F44336';
    else this.els.hudFuel.style.color = '#FF9800';
    
    this.updateOrdersUI();
  }
  
  updateOrdersUI() {
    const orders = this.game.orderSystem.orders;
    let html = '';
    
    for (let i = 0; i < 3; i++) {
      const order = orders[i];
      if (order) {
        const timeRemaining = Math.max(0, order.timer);
        const isBlinking = timeRemaining <= 30 ? 'blinking-red' : '';
        const statusText = order.state === 'PICKING_UP' ? 'Đang đi lấy hàng' : 'Đang đi giao hàng';
        
        html += `
          <div class="order-slot ${isBlinking}" style="border-left-color: ${order.color}">
            <div class="slot-header">
              <span>${statusText}</span>
              <span>⏱ ${this.formatTime(timeRemaining)}</span>
            </div>
            <div class="slot-title">${order.customer.name}</div>
            <div class="slot-subtitle">Phí ship: ${order.baseMoney.toLocaleString()}đ</div>
          </div>
        `;
      } else {
        html += `
          <div class="order-slot empty">
            <div class="slot-title" style="color: var(--text-muted)">Trống</div>
            <div class="slot-subtitle">Đang chờ đơn mới...</div>
          </div>
        `;
      }
    }
    
    this.els.ordersContainer.innerHTML = html;
  }
  
  updateShopUI() {
    const stats = this.game.orderSystem.stats;
    document.getElementById('endMoney').innerText = stats.money.toLocaleString() + 'đ';
    
    const speedLv = this.saveSystem.data.upgrades.speed;
    const brakesLv = this.saveSystem.data.upgrades.brakes;
    
    this.els.shopSpeedLv.innerText = speedLv;
    this.els.shopBrakesLv.innerText = brakesLv;
    
    const speedCost = this.saveSystem.getUpgradeCost('speed');
    const brakesCost = this.saveSystem.getUpgradeCost('brakes');
    
    this.els.btnUpgradeSpeed.innerText = speedLv >= 5 ? 'MAX' : `${speedCost.toLocaleString()}đ`;
    this.els.btnUpgradeBrakes.innerText = brakesLv >= 5 ? 'MAX' : `${brakesCost.toLocaleString()}đ`;
    
    this.els.btnUpgradeSpeed.disabled = speedLv >= 5 || stats.money < speedCost;
    this.els.btnUpgradeBrakes.disabled = brakesLv >= 5 || stats.money < brakesCost;
  }

  showEndOfDay(stats) {
    this.els.hud.classList.add('hidden');
    this.els.endDay.classList.remove('hidden');
    
    const shift = this.saveSystem.data.shift;
    this.els.endShiftNum.innerText = shift;
    
    const type = shift % 3 === 1 ? 'Ca Sáng' : (shift % 3 === 2 ? 'Ca Chiều' : 'Ca Tối');
    this.els.endShiftType.innerText = type;
    
    document.getElementById('endOrders').innerText = stats.successfulOrders;
    document.getElementById('endRating').innerText = stats.rating.toFixed(1);
    document.getElementById('endCollisions').innerText = stats.collisions + ' lần';
    
    // Luôn lưu điểm cao nhất
    this.saveSystem.addLeaderboardEntry({
      shift: shift,
      money: stats.money,
      rating: stats.rating
    });
    
    this.saveSystem.data.money = stats.money; // Sync money to save
    this.updateShopUI();
  }
  
  showGameOver(reason) {
    this.els.hud.classList.add('hidden');
    this.els.gameOver.classList.remove('hidden');
    document.getElementById('gameOverReasons').innerHTML = `<li>${reason}</li>`;
    
    // Lưu điểm nếu chết
    this.saveSystem.addLeaderboardEntry({
      shift: this.saveSystem.data.shift,
      money: this.game.orderSystem.stats.money,
      rating: this.game.orderSystem.stats.rating
    });
  }
  
  showNotification(text, duration = 3000) {
    this.els.notifToast.innerText = text;
    this.els.notifToast.classList.remove('hidden');
    
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notifTimeout = setTimeout(() => {
      this.els.notifToast.classList.add('hidden');
    }, duration);
  }
  
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  updateMinimap(game) {
    if (!this.minimapCtx) {
      const cvs = document.getElementById('minimap');
      cvs.width = 150;
      cvs.height = 150;
      this.minimapCtx = cvs.getContext('2d');
      this.minimapWidth = cvs.width;
      this.minimapHeight = cvs.height;
    }
    
    const ctx = this.minimapCtx;
    const w = this.minimapWidth;
    const h = this.minimapHeight;
    const mapW = game.map.width;
    const mapH = game.map.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const scaleX = w / mapW;
    const scaleY = h / mapH;
    
    ctx.fillStyle = '#2d3326';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#3a3d45';
    for (const r of game.map.roads) {
      ctx.fillRect(r.x * scaleX, r.y * scaleY, r.w * scaleX, r.h * scaleY);
    }
    
    // Trạm xăng
    ctx.fillStyle = '#FF9800';
    for (const g of game.map.gasStations) {
      ctx.fillRect(g.x * scaleX, g.y * scaleY, g.w * scaleX, g.h * scaleY);
    }
    
    for (const order of game.orderSystem.orders) {
      if (!order) continue;
      if (order.state === 'DELIVERING' && order.dropoff) {
        ctx.fillStyle = order.color;
        ctx.beginPath();
        ctx.arc(order.dropoff.x * scaleX, order.dropoff.y * scaleY, 4, 0, Math.PI*2);
        ctx.fill();
      }
    }
    
    for (const p of game.orderSystem.pendingPickups) {
      ctx.fillStyle = '#FFC107';
      ctx.beginPath();
      ctx.arc(p.pickup.x * scaleX, p.pickup.y * scaleY, 4, 0, Math.PI*2);
      ctx.fill();
    }
    
    const px = game.player.body.position.x * scaleX;
    const py = game.player.body.position.y * scaleY;
    
    ctx.fillStyle = '#ff5722';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI*2);
    ctx.fill();
  }
}
