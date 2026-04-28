export class SaveSystem {
  constructor() {
    this.saveKey = 'delivery_chaos_save';
    this.data = this.load();
  }
  
  load() {
    const defaultData = {
      money: 0,
      shift: 1,
      upgrades: {
        speed: 0, // max 5
        brakes: 0 // max 5
      },
      leaderboard: [] // array of { shift, money, rating, date }
    };
    
    try {
      const saved = localStorage.getItem(this.saveKey);
      if (saved) {
        // Merge with default to handle schema updates
        const parsed = JSON.parse(saved);
        return { 
          ...defaultData, 
          ...parsed,
          upgrades: { ...defaultData.upgrades, ...(parsed.upgrades || {}) },
          leaderboard: parsed.leaderboard || []
        };
      }
    } catch (e) {
      console.error('Failed to load save', e);
    }
    
    return defaultData;
  }
  
  save() {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save', e);
    }
  }
  
  addLeaderboardEntry(entry) {
    this.data.leaderboard.push({ ...entry, date: new Date().toLocaleDateString() });
    this.data.leaderboard.sort((a, b) => b.money - a.money); // Sort by money
    if (this.data.leaderboard.length > 5) {
      this.data.leaderboard = this.data.leaderboard.slice(0, 5); // Keep top 5
    }
    this.save();
  }
  
  resetProgress() {
    this.data.shift = 1;
    this.data.money = 0;
    this.data.upgrades = { speed: 0, brakes: 0 };
    this.save();
  }

  getUpgradeCost(type) {
    const level = this.data.upgrades[type];
    if (level >= 5) return Infinity;
    return 50000 * Math.pow(2, level); // 50k, 100k, 200k, 400k, 800k
  }

  buyUpgrade(type) {
    const cost = this.getUpgradeCost(type);
    if (this.data.money >= cost && this.data.upgrades[type] < 5) {
      this.data.money -= cost;
      this.data.upgrades[type]++;
      this.save();
      return true;
    }
    return false;
  }
}
