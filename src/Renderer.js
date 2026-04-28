export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.shakeTime = 0;
    
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    });
  }

  beginFrame() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.save();
    
    // Apply camera transform
    this.ctx.translate(this.width / 2, this.height / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    
    let cx = this.camera.x;
    let cy = this.camera.y;
    
    if (this.shakeTime > 0) {
      cx += (Math.random() - 0.5) * 10;
      cy += (Math.random() - 0.5) * 10;
    }
    
    this.ctx.translate(-cx, -cy);
  }

  endFrame() {
    this.ctx.restore();
  }

  updateCamera(targetX, targetY, mapWidth, mapHeight, dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt / 1000;
      if (this.shakeTime < 0) this.shakeTime = 0;
    }
    
    // Follow target but clamp to map boundaries
    const halfW = (this.width / 2) / this.camera.zoom;
    const halfH = (this.height / 2) / this.camera.zoom;
    
    this.camera.x = Math.max(halfW, Math.min(mapWidth - halfW, targetX));
    this.camera.y = Math.max(halfH, Math.min(mapHeight - halfH, targetY));
  }
}
