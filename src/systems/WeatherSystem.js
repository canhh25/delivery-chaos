export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.type = 'CLEAR'; // CLEAR, RAIN, FOG
    this.timer = 0;
    this.particles = [];
  }
  
  update(dt) {
    if (this.game.state !== 'PLAYING') return;
    
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.timer = 15 + Math.random() * 20; // 15-35s
      
      const rand = Math.random();
      if (rand < 0.3) {
        this.type = 'RAIN';
        this.particles = [];
        for (let i = 0; i < 200; i++) {
          this.particles.push({
            x: Math.random() * this.game.map.width,
            y: Math.random() * this.game.map.height,
            speed: 15 + Math.random() * 10
          });
        }
        this.game.ui.showNotification("⛈ TRỜI MƯA! Cẩn thận trơn đường", 5000);
      } else {
        this.type = 'CLEAR';
        this.particles = [];
      }
    }
    
    if (this.type === 'RAIN') {
      this.game.player.weatherSpeedMultiplier = 0.6; // Mưa -> giảm tốc
      
      const px = this.game.player.body.position.x;
      const py = this.game.player.body.position.y;
      
      for (const p of this.particles) {
        p.y += p.speed;
        p.x -= p.speed * 0.2;
        
        if (p.y > py + 500) p.y = py - 500;
        if (p.x < px - 500) p.x = px + 500;
      }
    } else {
      this.game.player.weatherSpeedMultiplier = 1.0;
    }
  }
  
  render(ctx) {
    if (this.type === 'RAIN') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of this.particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y + 10);
      }
      ctx.stroke();
    }
  }

  renderPostProcessing(ctx, camera) {
    // 1. Vẽ Màn Đêm (Night)
    const shift = this.game.ui.saveSystem.data.shift;
    const isEvening = shift % 3 === 0;
    
    if (isEvening) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#445566'; // Night tint
      
      const cx = camera.x;
      const cy = camera.y;
      const cw = window.innerWidth / camera.zoom;
      const ch = window.innerHeight / camera.zoom;
      
      ctx.fillRect(cx - cw/2, cy - ch/2, cw, ch);
      ctx.restore();
    }
  }
}
