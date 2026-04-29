import { engine, Engine, Events } from './physics.js';
import { Renderer } from './Renderer.js';
import { Player } from './entities/Player.js';
import { TrafficManager } from './entities/TrafficManager.js';
import { MapSystem } from './systems/Map.js';
import { OrderSystem } from './systems/OrderSystem.js';
import { WeatherSystem } from './systems/WeatherSystem.js';
import { UIManager } from './ui/UIManager.js';
import { TrafficLightSystem } from './systems/TrafficLightSystem.js';
import { BGM, Sfx } from './audio.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new Renderer(this.canvas);
    
    this.map = new MapSystem();
    
    this.ui = new UIManager(this);
    
    // Spawn player trên đường đầu tiên
    const firstRoad = this.map.roads[0];
    const spawnX = firstRoad.isHorizontal ? this.map.width / 2 : firstRoad.center;
    const spawnY = firstRoad.isHorizontal ? firstRoad.center : this.map.height / 2;
    
    this.player = new Player(this, spawnX, spawnY);
    
    this.orderSystem = new OrderSystem(this);
    this.orderSystem.stats.money = this.ui.saveSystem.data.money; // Đồng bộ tiền từ save
    
    this.weatherSystem = new WeatherSystem(this);
    this.trafficManager = new TrafficManager(this);
    this.trafficLightSystem = new TrafficLightSystem(this);
    
    this.trafficLightSystem.init();
    
    this.lastTime = performance.now();
    this.state = 'MENU'; // MENU, PLAYING, DAY_END, GAMEOVER
    
    this.setupCollisions();
    
    // Start game loop
    requestAnimationFrame((t) => this.loop(t));
  }
  
  startShift() {
    this.state = 'PLAYING';
    this.orderSystem.shiftTimer = this.orderSystem.shiftLength;
    // Safety: ensure background music is running when the shift actually starts.
    BGM.start();
  }
  
  endShift() {
    this.state = 'DAY_END';
    BGM.stop();
    Sfx.engineOff();
    this.ui.showEndOfDay(this.orderSystem.stats);
  }
  
  triggerGameOver(reason) {
    this.state = 'GAMEOVER';
    BGM.stop();
    Sfx.engineOff();
    this.ui.showGameOver(reason);
  }
  
  setupCollisions() {
    Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
      for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        if (bodyA.label === 'Player' || bodyB.label === 'Player') {
          const other = bodyA.label === 'Player' ? bodyB : bodyA;
          
          if (other.label === 'Vehicle') {
            this.handleCollision('Vehicle');
          } else if (other.label === 'Building') {
            this.handleCollision('Building');
          } else if (other.label === 'Animal') {
            this.handleCollision('Animal');
          } else if (other.label === 'StopLine_H' && this.trafficLightSystem.isRed('H')) {
            this.handleRedLightPenalty(other, bodyA.label === 'Player' ? bodyA : bodyB);
          } else if (other.label === 'StopLine_V' && this.trafficLightSystem.isRed('V')) {
            this.handleRedLightPenalty(other, bodyA.label === 'Player' ? bodyA : bodyB);
          }
        }
      }
    });
  }
  
  handleRedLightPenalty(stopLineBody, playerBody) {
    const vel = playerBody.velocity;
    // Bỏ qua nếu xe đứng yên hoặc chạy quá chậm
    if (Math.abs(vel.x) < 0.5 && Math.abs(vel.y) < 0.5) return;
    
    // Tính góc di chuyển của player (radian)
    let playerAngle = Math.atan2(vel.y, vel.x);
    if (playerAngle < 0 && stopLineBody.allowedAngle === Math.PI) {
      playerAngle += 2 * Math.PI; // Normalize góc âm
    }
    
    let diff = Math.abs(playerAngle - stopLineBody.allowedAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff; // Lấy góc hẹp
    
    // Tolerance 30 độ = ~0.523 radian
    if (diff > 0.523) return; // Không trùng hướng kiểm soát -> bỏ qua
    
    const now = Date.now();
    this.redLightCooldowns = this.redLightCooldowns || {};
    const intId = stopLineBody.intId !== undefined ? stopLineBody.intId : 'global';
    const lastPenalty = this.redLightCooldowns[intId] || 0;
    
    // Cooldown 2 giây cho CÙNG MỘT ngã tư
    if (now - lastPenalty > 2000) {
      this.redLightCooldowns[intId] = now;
      this.orderSystem.stats.money -= 10000;
      this.ui.showNotification("🛑 VƯỢT ĐÈN ĐỎ! Phạt 10,000đ", 3000);
      Sfx.redLightPenalty();
      this.renderer.shakeTime = 0.2;
    }
  }

  handleCollision(type) {
    this.renderer.shakeTime = 0.3;

    Sfx.collision(type);
    
    if (type === 'Vehicle') {
      this.orderSystem.stats.collisions++;
      this.orderSystem.stats.money -= 5000;
      this.player.speedMultiplier = 0.3;
      setTimeout(() => { this.player.speedMultiplier = 1.0; }, 2000);
      this.ui.showNotification("💥 Đâm xe! Phạt 5,000đ", 2000);
    } else if (type === 'Animal') {
      this.player.speedMultiplier = 0.0; // Dừng hẳn
      setTimeout(() => { this.player.speedMultiplier = 1.0; }, 1000);
      this.ui.showNotification("🐔 Đụng động vật! Chậm 1 giây", 1000);
    } else if (type === 'Building') {
      this.player.speedMultiplier = 0.5;
      setTimeout(() => { this.player.speedMultiplier = 1.0; }, 1000);
    }
  }
  
  loop(timestamp) {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    
    const dt = Math.min(deltaTime, 100);
    
    if (this.state === 'PLAYING') {
      this.update(dt);
    }
    
    this.render();
    
    requestAnimationFrame((t) => this.loop(t));
  }
  
  update(dt) {
    Engine.update(engine, dt);
    
    this.player.update(dt);
    this.trafficManager.update(dt);
    this.orderSystem.update(dt);
    this.weatherSystem.update(dt);
    this.trafficLightSystem.update(dt);
    
    const targetX = this.player.body.position.x;
    const targetY = this.player.body.position.y;
    this.renderer.updateCamera(targetX, targetY, this.map.width, this.map.height, dt);
  }
  
  render() {
    this.renderer.beginFrame();
    
    this.map.render(this.renderer.ctx);
    this.trafficLightSystem.render(this.renderer.ctx);
    this.orderSystem.render(this.renderer.ctx);
    this.player.render(this.renderer.ctx);
    this.trafficManager.render(this.renderer.ctx);
    this.weatherSystem.render(this.renderer.ctx);
    
    this.weatherSystem.renderPostProcessing(this.renderer.ctx, this.renderer.camera);
    
    this.renderer.endFrame();
    
    if (this.state === 'PLAYING') {
      this.ui.updateMinimap(this);
    }
  }
}
