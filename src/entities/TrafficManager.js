import { Bodies, Composite, world } from '../physics.js';
import Matter from 'matter-js';

export class TrafficManager {
  constructor(game) {
    this.game = game;
    this.vehicles = [];
    this.animals = [];
    this.maxVehicles = 25; // Tăng lượng xe
    this.maxAnimals = 8;
  }
  
  update(dt) {
    if (this.game.state !== 'PLAYING') return;

    if (this.vehicles.length < this.maxVehicles && Math.random() < 0.05) {
      this.spawnVehicle();
    }
    if (this.animals.length < this.maxAnimals && Math.random() < 0.01) {
      this.spawnAnimal();
    }
    
    this.updateVehicles(dt);
    this.updateAnimals(dt);
  }

  updateVehicles(dt) {
    const lights = this.game.trafficLightSystem ? this.game.trafficLightSystem.lights : [];

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      let shouldStop = false;
      let atIntersectionCenter = null;

      // Quét các ngã tư
      for (const l of lights) {
        const { int } = l;
        
        // Kiểm tra dừng đèn đỏ
        if (v.dir === 0 && Math.abs(v.body.position.y - int.cy) < int.hr.h/2) {
          const dist = int.x - v.body.position.x - 20;
          if (dist > 0 && dist < 40 && this.game.trafficLightSystem.isRed('H')) shouldStop = true;
        } else if (v.dir === 2 && Math.abs(v.body.position.y - int.cy) < int.hr.h/2) {
          const dist = v.body.position.x - (int.x + int.w) - 20;
          if (dist > 0 && dist < 40 && this.game.trafficLightSystem.isRed('H')) shouldStop = true;
        } else if (v.dir === 1 && Math.abs(v.body.position.x - int.cx) < int.vr.w/2) {
          const dist = int.y - v.body.position.y - 20;
          if (dist > 0 && dist < 40 && this.game.trafficLightSystem.isRed('V')) shouldStop = true;
        } else if (v.dir === 3 && Math.abs(v.body.position.x - int.cx) < int.vr.w/2) {
          const dist = v.body.position.y - (int.y + int.h) - 20;
          if (dist > 0 && dist < 40 && this.game.trafficLightSystem.isRed('V')) shouldStop = true;
        }

        // Kiểm tra đang ở giữa ngã tư để rẽ (tăng vùng bắt lên 15px)
        if (Math.abs(v.body.position.x - int.cx) < 15 && Math.abs(v.body.position.y - int.cy) < 15) {
          if (!v.lastTurnInt || v.lastTurnInt !== int) {
            atIntersectionCenter = int;
          }
        }
      }

      if (shouldStop) {
        Matter.Body.setVelocity(v.body, { x: 0, y: 0 });
        v.stuckTimer = 0; // Đang chờ đèn đỏ, không tính là kẹt
        continue;
      }

      // Phát hiện xe bị kẹt (bị người chơi húc văng vào tường)
      const dx = Math.abs(v.body.position.x - (v.lastX || v.body.position.x));
      const dy = Math.abs(v.body.position.y - (v.lastY || v.body.position.y));
      
      if (dx < 0.5 && dy < 0.5) {
        v.stuckTimer = (v.stuckTimer || 0) + dt;
        if (v.stuckTimer > 1500) { // Kẹt 1.5 giây -> Rẽ trái hoặc phải tìm đường thoát
          v.dir = (v.dir + (Math.random() < 0.5 ? 1 : 3)) % 4; // Bẻ lái 90 độ
          v.stuckTimer = 0;
        }
      } else {
        v.stuckTimer = 0;
      }
      v.lastX = v.body.position.x;
      v.lastY = v.body.position.y;

      // Xử lý rẽ tại ngã tư
      if (atIntersectionCenter) {
        v.lastTurnInt = atIntersectionCenter;
        const int = atIntersectionCenter;
        
        let turned = false;
        
        if (Math.random() < 0.4) { // 40% rẽ
          const isCar = v.type === 'CAR';
          const validDirs = [];
          
          if (v.dir === 0 || v.dir === 2) { // Đang đi ngang, rẽ dọc
            if (!isCar || int.vr.type !== 'ALLEY') {
              validDirs.push(1); // Xuống
              validDirs.push(3); // Lên
            }
          } else { // Đang đi dọc, rẽ ngang
            if (!isCar || int.hr.type !== 'ALLEY') {
              validDirs.push(0); // Phải
              validDirs.push(2); // Trái
            }
          }
          
          if (validDirs.length > 0) {
            v.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            Matter.Body.setPosition(v.body, { x: int.cx, y: int.cy });
            turned = true;
          }
        }
        
        if (!turned) {
          // Đi thẳng -> nắn lại trục đường để không bị trôi vào lề
          if (v.dir === 0 || v.dir === 2) {
            Matter.Body.setPosition(v.body, { x: v.body.position.x, y: int.cy });
          } else {
            Matter.Body.setPosition(v.body, { x: int.cx, y: v.body.position.y });
          }
        }
      }

      // Di chuyển
      let vx = 0; let vy = 0;
      if (v.dir === 0) vx = v.speed;
      else if (v.dir === 1) vy = v.speed;
      else if (v.dir === 2) vx = -v.speed;
      else if (v.dir === 3) vy = -v.speed;

      Matter.Body.setVelocity(v.body, { x: vx, y: vy });
      Matter.Body.setAngle(v.body, v.dir * Math.PI / 2);

      // Xóa nếu ra khỏi map
      const {x, y} = v.body.position;
      if (x < -100 || x > this.game.map.width + 100 || y < -100 || y > this.game.map.height + 100) {
        Composite.remove(world, v.body);
        this.vehicles.splice(i, 1);
      }
    }
  }

  updateAnimals(dt) {
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      Matter.Body.setVelocity(a.body, { x: Math.cos(a.dir) * a.speed, y: Math.sin(a.dir) * a.speed });
      if (Math.random() < 0.05) a.dir += (Math.random() - 0.5) * 1.5;
      
      const {x, y} = a.body.position;
      if (x < -50 || x > this.game.map.width + 50 || y < -50 || y > this.game.map.height + 50) {
        Composite.remove(world, a.body);
        this.animals.splice(i, 1);
      }
    }
  }
  
  spawnVehicle() {
    const isCar = Math.random() < 0.7; // 70% xe hơi, 30% xe máy
    const type = isCar ? 'CAR' : 'BIKE';
    
    // Lọc đường hợp lệ
    let validRoads = this.game.map.roads;
    if (isCar) {
      validRoads = validRoads.filter(r => r.type === 'MAIN' || r.type === 'MINOR');
    }
    if (validRoads.length === 0) return;
    
    const road = validRoads[Math.floor(Math.random() * validRoads.length)];
    
    let x, y, dir;
    if (road.isHorizontal) {
      x = Math.random() > 0.5 ? 0 : this.game.map.width;
      y = road.center;
      dir = x === 0 ? 0 : 2; // Từ trái qua phải (0) hoặc từ phải qua trái (2)
    } else {
      x = road.center;
      y = Math.random() > 0.5 ? 0 : this.game.map.height;
      dir = y === 0 ? 1 : 3; // Từ trên xuống (1) hoặc từ dưới lên (3)
    }
    
    const w = isCar ? 40 : 20;
    const h = isCar ? 20 : 10;
    
    const body = Bodies.rectangle(x, y, w, h, {
      frictionAir: 0.1, restitution: 0.2, label: 'Vehicle'
    });
    
    Matter.Body.setAngle(body, dir * Math.PI / 2);
    Composite.add(world, body);
    
    this.vehicles.push({
      body, speed: (1.5 + Math.random() * 2.0) * (isCar ? 1 : 1.2),
      color: `hsl(${Math.random()*360}, 70%, 50%)`, dir, type
    });
  }

  spawnAnimal() {
    const road = this.game.map.roads[Math.floor(Math.random() * this.game.map.roads.length)];
    let x, y;
    if (road.isHorizontal) {
      x = Math.random() * this.game.map.width; y = road.center;
    } else {
      x = road.center; y = Math.random() * this.game.map.height;
    }
    
    const body = Bodies.circle(x, y, 10, {
      frictionAir: 0.1, restitution: 0.5, label: 'Animal'
    });
    
    Composite.add(world, body);
    this.animals.push({
      body, speed: 0.5 + Math.random() * 0.8,
      type: Math.random() > 0.5 ? '🐔' : '🐕', dir: Math.random() * Math.PI * 2
    });
  }
  
  render(ctx) {
    for (const v of this.vehicles) {
      const { x, y } = v.body.position;
      ctx.save(); ctx.translate(x, y); ctx.rotate(v.body.angle);
      
      ctx.fillStyle = v.color;
      if (v.type === 'CAR') {
        ctx.fillRect(-20, -10, 40, 20);
        ctx.fillStyle = '#000'; ctx.fillRect(5, -8, 10, 16);
      } else {
        ctx.fillRect(-10, -5, 20, 10);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    for (const a of this.animals) {
      ctx.font = '24px Inter';
      ctx.fillText(a.type, a.body.position.x - 12, a.body.position.y + 8);
    }
  }
}
