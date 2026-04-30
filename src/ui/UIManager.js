import { SaveSystem } from '../systems/SaveSystem.js';
import { initAudio, BGM, Sfx } from '/src/audio.js';
export class UIManager {
  constructor(game) {
    this.game = game;
    this.saveSystem = new SaveSystem();
    this._playedShiftStartSound = false;
    
    this.els = {
      mainMenu: document.getElementById('mainMenu'),
      hud: document.getElementById('hud'),
      gameOver: document.getElementById('gameOver'),
      endOfDay: document.getElementById('endOfDay'),
      hudMoney: document.getElementById('hudMoney'),
      hudTimer: document.getElementById('hudTimer'),
      hudRating: document.getElementById('hudRating'),
      hudFuel: document.getElementById('hudFuel'),
      ordersContainer: document.getElementById('ordersContainer'),
      notifToast: document.getElementById('notifToast'),
      leaderboardList: document.getElementById('leaderboardList')
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
    if (!this._playedShiftStartSound) {
      Sfx.shiftStart();
      this._playedShiftStartSound = true;
    }
      this.els.mainMenu.classList.add('hidden');
      this.els.hud.classList.remove('hidden');
      this.game.startShift();
    });
    
    document.getElementById('btnEndToMenu').addEventListener('click', () => {
      this.saveSystem.resetProgress();
      location.reload();
    });
    
    document.getElementById('btnRetry').addEventListener('click', () => {
      this.saveSystem.resetProgress();
      location.reload();
    });
    
    document.getElementById('btnMenu').addEventListener('click', () => {
      location.reload();
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
  
  showEndOfDay(stats) {
    // Nếu tiền <= 0 thì bị sa thải, không lưu vào bảng xếp hạng
    if (stats.money <= 0) {
      this.els.hud.classList.add('hidden');
      this.els.gameOver.classList.remove('hidden');
      document.getElementById('gameOverReasons').innerHTML = `<li>Tiền của bạn đã hết, bạn bị sa thải!</li>`;
      return;
    }
    
    this.els.hud.classList.add('hidden');
    this.els.endOfDay.classList.remove('hidden');
    
    document.getElementById('endMoney').innerText = stats.money.toLocaleString() + 'đ';
    document.getElementById('endOrders').innerText = stats.successfulOrders;
    document.getElementById('endRating').innerText = stats.rating.toFixed(1);
    document.getElementById('endCollisions').innerText = stats.collisions + ' lần';
    
    const shift = this.saveSystem.data.shift;
    
    // Chỉ lưu vào bảng xếp hạng nếu tiền > 0
    this.saveSystem.addLeaderboardEntry({
      shift: shift,
      money: stats.money,
      rating: stats.rating
    });
  }
  
  showGameOver(reason) {
    this.els.hud.classList.add('hidden');
    this.els.gameOver.classList.remove('hidden');
    document.getElementById('gameOverReasons').innerHTML = `<li>${reason}</li>`;
    // Không lưu vào bảng xếp hạng khi bị sa thải
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
