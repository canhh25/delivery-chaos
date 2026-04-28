import { Bodies, Composite, world } from '../physics.js';

export class TrafficLightSystem {
  constructor(game) {
    this.game = game;
    this.lights = [];
    
    // state: 0 = H-Green/V-Red, 1 = H-Yellow/V-Red, 2 = H-Red/V-Green, 3 = H-Red/V-Yellow
    this.state = 0;
    this.timer = 8;
  }
  
  init() {
    let intIndex = 0;
    for (const int of this.game.map.intersections) {
      if (!int.hasLight) continue;
      
      // Vạch dừng cho hướng ngang (H)
      const hrStopLeft = Bodies.rectangle(int.x - 5, int.cy, 10, int.hr.h, { isSensor: true, isStatic: true, label: 'StopLine_H' });
      hrStopLeft.allowedAngle = 0; // Trái sang phải
      hrStopLeft.intId = intIndex;
      
      const hrStopRight = Bodies.rectangle(int.x + int.w + 5, int.cy, 10, int.hr.h, { isSensor: true, isStatic: true, label: 'StopLine_H' });
      hrStopRight.allowedAngle = Math.PI; // Phải sang trái (hoặc -PI)
      hrStopRight.intId = intIndex;
      
      // Vạch dừng cho hướng dọc (V)
      const vrStopTop = Bodies.rectangle(int.cx, int.y - 5, int.vr.w, 10, { isSensor: true, isStatic: true, label: 'StopLine_V' });
      vrStopTop.allowedAngle = Math.PI / 2; // Trên xuống dưới
      vrStopTop.intId = intIndex;
      
      const vrStopBottom = Bodies.rectangle(int.cx, int.y + int.h + 5, int.vr.w, 10, { isSensor: true, isStatic: true, label: 'StopLine_V' });
      vrStopBottom.allowedAngle = -Math.PI / 2; // Dưới lên trên
      vrStopBottom.intId = intIndex;
      
      Composite.add(world, [hrStopLeft, hrStopRight, vrStopTop, vrStopBottom]);
      
      this.lights.push({
        int: int,
        bodies: { hrStopLeft, hrStopRight, vrStopTop, vrStopBottom }
      });
      intIndex++;
    }
  }
  
  update(dt) {
    if (this.game.state !== 'PLAYING') return;
    
    this.timer -= dt / 1000;
    if (this.timer <= 0) {
      this.state = (this.state + 1) % 4;
      if (this.state === 0 || this.state === 2) this.timer = 8; // Xanh 8s
      else this.timer = 2; // Vàng 2s
    }
  }
  
  getHColor() {
    if (this.state === 0) return '#4CAF50';
    if (this.state === 1) return '#FFC107';
    return '#F44336';
  }
  
  getVColor() {
    if (this.state === 2) return '#4CAF50';
    if (this.state === 3) return '#FFC107';
    return '#F44336';
  }
  
  isRed(direction) {
    if (direction === 'H') return this.state === 2 || this.state === 3;
    if (direction === 'V') return this.state === 0 || this.state === 1;
    return false;
  }
  
  isYellow(direction) {
    if (direction === 'H') return this.state === 1;
    if (direction === 'V') return this.state === 3;
    return false;
  }
  
  render(ctx) {
    const hc = this.getHColor();
    const vc = this.getVColor();
    
    for (const l of this.lights) {
      const { int } = l;
      
      // Đèn hướng ngang
      ctx.fillStyle = '#000';
      ctx.fillRect(int.x - 16, int.cy - 12, 12, 24);
      ctx.fillRect(int.x + int.w + 4, int.cy - 12, 12, 24);
      ctx.fillStyle = hc;
      ctx.beginPath(); ctx.arc(int.x - 10, int.cy, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(int.x + int.w + 10, int.cy, 4, 0, Math.PI*2); ctx.fill();
      
      // Đèn hướng dọc
      ctx.fillStyle = '#000';
      ctx.fillRect(int.cx - 12, int.y - 16, 24, 12);
      ctx.fillRect(int.cx - 12, int.y + int.h + 4, 24, 12);
      ctx.fillStyle = vc;
      ctx.beginPath(); ctx.arc(int.cx, int.y - 10, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(int.cx, int.y + int.h + 10, 4, 0, Math.PI*2); ctx.fill();
    }
  }
}
