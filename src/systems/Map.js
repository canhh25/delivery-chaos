import { Bodies, Composite, world } from '../physics.js';

export class MapSystem {
  constructor() {
    this.width = 4000;
    this.height = 4000;
    this.roads = [];
    this.buildings = [];
    this.intersections = [];
    this.trees = [];
    this.gasStations = [];
    
    this.generateCity();
  }
  
  generateCity() {
    // 1. Generate Roads
    // Main Roads (120px)
    const mainRoadsH = [800, 2400];
    const mainRoadsV = [1200, 2800];
    
    // Minor Roads (60px)
    const minorRoadsH = [400, 1600, 3200, 3600];
    const minorRoadsV = [400, 2000, 3600];
    
    // Alleys (30px)
    const alleysH = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400, 3800];
    const alleysV = [200, 800, 1600, 2400, 3200, 3800];

    // Tạo các object Road
    for (const y of mainRoadsH) this.roads.push({ x: 0, y: y, w: this.width, h: 120, type: 'MAIN', isHorizontal: true, center: y + 60 });
    for (const y of minorRoadsH) this.roads.push({ x: 0, y: y, w: this.width, h: 60, type: 'MINOR', isHorizontal: true, center: y + 30 });
    for (const y of alleysH) this.roads.push({ x: 0, y: y, w: this.width, h: 30, type: 'ALLEY', isHorizontal: true, center: y + 15 });
    
    for (const x of mainRoadsV) this.roads.push({ x: x, y: 0, w: 120, h: this.height, type: 'MAIN', isHorizontal: false, center: x + 60 });
    for (const x of minorRoadsV) this.roads.push({ x: x, y: 0, w: 60, h: this.height, type: 'MINOR', isHorizontal: false, center: x + 30 });
    for (const x of alleysV) this.roads.push({ x: x, y: 0, w: 30, h: this.height, type: 'ALLEY', isHorizontal: false, center: x + 15 });

    // 2. Tọa giao lộ (Intersections)
    const hRoads = this.roads.filter(r => r.isHorizontal);
    const vRoads = this.roads.filter(r => !r.isHorizontal);
    
    for (const hr of hRoads) {
      for (const vr of vRoads) {
        const needsLight = (hr.type === 'MAIN' && vr.type === 'MAIN') || 
                           (hr.type === 'MAIN' && vr.type === 'MINOR') || 
                           (hr.type === 'MINOR' && vr.type === 'MAIN');
                           
        this.intersections.push({
          x: vr.x, y: hr.y,
          w: vr.w, h: hr.h,
          cx: vr.center, cy: hr.center,
          hasLight: needsLight,
          hr: hr, vr: vr
        });
      }
    }

    // 3. Generate Buildings
    const hEdges = [0];
    const vEdges = [0];
    
    for (const r of this.roads) {
      if (r.isHorizontal) {
        hEdges.push(r.y); hEdges.push(r.y + r.h);
      } else {
        vEdges.push(r.x); vEdges.push(r.x + r.w);
      }
    }
    
    hEdges.push(this.height);
    vEdges.push(this.width);
    
    hEdges.sort((a,b) => a-b);
    vEdges.sort((a,b) => a-b);
    
    const blockBodies = [];
    
    for (let i = 0; i < hEdges.length - 1; i++) {
      for (let j = 0; j < vEdges.length - 1; j++) {
        const top = hEdges[i]; const bottom = hEdges[i+1];
        const left = vEdges[j]; const right = vEdges[j+1];
        
        const w = right - left;
        const h = bottom - top;
        
        if (w <= 0 || h <= 0) continue;
        
        const cx = left + w/2;
        const cy = top + h/2;
        
        let isRoad = false;
        for (const r of this.roads) {
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
            isRoad = true; break;
          }
        }
        
        if (!isRoad && w > 20 && h > 20) {
    const padding = 12; // Vỉa hè mặc định
    const bWidth = w - padding * 2;
    const bHeight = h - padding * 2;
    const bx = left + padding;
    const by = top + padding;

    const rand = Math.random();
    let type = 'HOUSE'; 
    let color = '#795548'; 
    let icon = '';

    // Phân loại công trình (Giữ nguyên tỉ lệ cũ)
    if (bWidth > 150 && bHeight > 150) {
        if (rand < 0.15) { type = 'GAS_STATION'; color = '#FF9800'; icon = '⛽'; }
        else if (rand < 0.35) { type = 'MARKET'; color = '#d32f2f'; icon = '🛒'; }
        else { type = 'APARTMENT'; color = '#607d8b'; }
    } else {
        if (rand < 0.2) { type = 'RESTAURANT'; color = '#ff9800'; icon = '🍜'; }
        else if (rand < 0.4) { type = 'APARTMENT'; color = '#607d8b'; }
    }

    if (type === 'GAS_STATION') {
        // --- CHẾ ĐỘ XÂY DỰNG TRẠM XĂNG (CÓ HẺM VÀO SÂU) ---
        // 1. Định nghĩa độ sâu hẻm (80px là đủ để xe quay đầu thoải mái)
        const alleyDepth = 80; 
        
        // 2. Cắt bỏ vỉa hè phía trước và đẩy tòa nhà lùi vào trong
        const buildingX = bx + alleyDepth; 
        const buildingW = bWidth - alleyDepth;

        this.buildings.push({
            x: buildingX, y: by, w: buildingW, h: bHeight, 
            type, color, icon, blockW: w, blockH: h, blockX: left, blockY: top,
            hasAlley: true,
            // Lưu tọa độ hẻm để vẽ sau này
            alleyRect: { x: bx, y: by, w: alleyDepth, h: bHeight }
        });

        // 3. Đăng ký vùng đổ xăng (Sensor) nằm đúng trong hẻm trống
        this.gasStations.push({ 
            x: bx, y: by, w: alleyDepth, h: bHeight 
        });

        // 4. VẬT LÝ - CHỈ TẠO KHỐI CỨNG CHO PHẦN TÒA NHÀ THỤT LÙI
        blockBodies.push(Bodies.rectangle(buildingX + buildingW/2, by + bHeight/2, buildingW, bHeight, {
            isStatic: true, label: 'Building'
        }));

        // 5. VẬT LÝ - TẠO SENSOR CHO HẺM (Xe lái vào được để đổ xăng)
        // Đặt label là 'GasStation' để Game.js nhận diện và đổ xăng
        blockBodies.push(Bodies.rectangle(bx + alleyDepth/2, by + bHeight/2, alleyDepth, bHeight, {
            isStatic: true, isSensor: true, label: 'GasStation'
        }));

    } else {
        // --- CHẾ ĐỘ XÂY DỰNG BÌNH THƯỜNG (Giữ nguyên code cũ) ---
        this.buildings.push({
            x: bx, y: by, w: bWidth, h: bHeight, type, color, icon, blockW: w, blockH: h, blockX: left, blockY: top
        });

        blockBodies.push(Bodies.rectangle(bx + bWidth/2, by + bHeight/2, bWidth, bHeight, {
            isStatic: true, label: 'Building'
        }));
    }

    // Spawn cây xanh (giữ nguyên)
    if (Math.random() < 0.7) {
        this.trees.push({x: left + padding/2, y: top + h/2});
    }
}
      }
    }
    
    Composite.add(world, blockBodies);
    
    // Map Boundaries
    const boundOptions = { isStatic: true, label: 'Building' };
    Composite.add(world, [
      Bodies.rectangle(this.width/2, -50, this.width, 100, boundOptions),
      Bodies.rectangle(this.width/2, this.height+50, this.width, 100, boundOptions),
      Bodies.rectangle(-50, this.height/2, 100, this.height, boundOptions),
      Bodies.rectangle(this.width+50, this.height/2, 100, this.height, boundOptions)
    ]);
  }
  
  render(ctx) {
    ctx.fillStyle = '#2d3326';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = '#9e9e9e'; // Vỉa hè
    for (const b of this.buildings) ctx.fillRect(b.blockX, b.blockY, b.blockW, b.blockH);
    
    for (const r of this.roads) {
      ctx.fillStyle = '#3a3d45'; // Đường
      ctx.fillRect(r.x, r.y, r.w, r.h);
      
      if (r.type === 'MAIN' || r.type === 'MINOR') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        if (r.isHorizontal) {
          ctx.moveTo(r.x, r.center); ctx.lineTo(r.x + r.w, r.center);
        } else {
          ctx.moveTo(r.center, r.y); ctx.lineTo(r.center, r.y + r.h);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    ctx.fillStyle = '#3a3d45';
    for (const int of this.intersections) ctx.fillRect(int.x, int.y, int.w, int.h);
    
    for (const b of this.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.icon) {
        ctx.font = '24px Inter';
        ctx.fillText(b.icon, b.x + b.w/2 - 12, b.y + b.h/2 + 8);
      }
    }
    
    ctx.fillStyle = '#4CAF50'; // Cây
    for (const t of this.trees) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8, 0, Math.PI*2);
      ctx.fill();
    }
  }
}
