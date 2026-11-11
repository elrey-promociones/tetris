export interface NeonParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  glowColor: string;
  size: number;
  alpha: number;
  life: number;
  decay: number;
  trail: { x: number; y: number }[];
  maxTrailLength: number;
}

export interface LineFlash {
  y: number;
  height: number;
  alpha: number;
  decay: number;
  color: string;
  isTetris: boolean;
  spread: number;
}

export interface TetrisShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

export interface TetrisBannerEffect {
  text: string;
  subtext: string;
  alpha: number;
  scale: number;
  y: number;
  life: number;
  color: string;
}

const NEON_PALETTE = [
  { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.9)' },
  { main: '#fde047', glow: 'rgba(253, 224, 71, 0.9)' },
  { main: '#4ade80', glow: 'rgba(74, 222, 128, 0.9)' },
  { main: '#f43f5e', glow: 'rgba(244, 63, 94, 0.9)' },
  { main: '#c084fc', glow: 'rgba(192, 132, 252, 0.9)' },
];

export class NeonParticleSystem {
  public particles: NeonParticle[] = [];
  public flashes: LineFlash[] = [];
  public shockwaves: TetrisShockwave[] = [];
  public banners: TetrisBannerEffect[] = [];

  public triggerLineClear(rows: number[], isTetris: boolean, canvasWidth = 300, blockSize = 30) {
    const particleMultiplier = isTetris ? 1.8 : 1.0;
    const basePalette = isTetris
      ? [{ main: '#fde047', glow: 'rgba(253, 224, 71, 0.95)' }, { main: '#38bdf8', glow: 'rgba(56, 189, 248, 0.95)' }]
      : NEON_PALETTE;

    rows.forEach((rowIdx) => {
      const lineCenterY = rowIdx * blockSize + blockSize / 2;

      this.flashes.push({
        y: rowIdx * blockSize,
        height: blockSize,
        alpha: 1.0,
        decay: isTetris ? 0.04 : 0.065,
        color: isTetris ? '#fde047' : '#38bdf8',
        isTetris,
        spread: 0,
      });

      const particleCount = Math.floor(26 * particleMultiplier);
      for (let i = 0; i < particleCount; i++) {
        const x = (canvasWidth / particleCount) * i + (Math.random() * 12 - 6);
        const y = lineCenterY + (Math.random() * 14 - 7);
        const paletteChoice = basePalette[Math.floor(Math.random() * basePalette.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = isTetris ? Math.random() * 5.5 + 2.0 : Math.random() * 4.0 + 1.2;

        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * speed * 0.7 - (isTetris ? 1.8 : 0.8),
          color: paletteChoice.main,
          glowColor: paletteChoice.glow,
          size: Math.random() * 2.8 + 1.6,
          alpha: 1.0,
          life: 1.0,
          decay: Math.random() * 0.02 + (isTetris ? 0.014 : 0.024),
          trail: [],
          maxTrailLength: isTetris ? 8 : 6,
        });
      }
    });

    if (isTetris && rows.length > 0) {
      const midRow = rows[Math.floor(rows.length / 2)];
      const centerY = midRow * blockSize + blockSize / 2;
      const centerX = canvasWidth / 2;

      this.shockwaves.push({
        x: centerX,
        y: centerY,
        radius: 10,
        maxRadius: 180,
        alpha: 1.0,
        color: '#fde047',
        lineWidth: 5,
      });

      this.banners.push({
        text: '⚡ ¡TETRIS! ⚡',
        subtext: '+150 FICHAS VIP',
        alpha: 1.0,
        scale: 0.7,
        y: centerY - 15,
        life: 1.0,
        color: '#fde047',
      });
    }
  }

  public update() {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.alpha -= f.decay;
      f.spread += 0.8;
      if (f.alpha <= 0) this.flashes.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 5.5;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > p.maxTrailLength) p.trail.pop();

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vy += 0.07;
      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0 || p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.life -= 0.022;
      b.alpha = Math.max(0, b.life);
      b.y -= 0.6;
      if (b.scale < 1.1) b.scale += 0.03;
      if (b.life <= 0) this.banners.splice(i, 1);
    }
  }

  public draw(ctx: CanvasRenderingContext2D, canvasWidth = 300) {
    if (
      this.flashes.length === 0 &&
      this.particles.length === 0 &&
      this.shockwaves.length === 0 &&
      this.banners.length === 0
    ) return;

    ctx.save();

    this.flashes.forEach((f) => {
      const midY = f.y + f.height / 2;
      ctx.fillStyle = f.color === '#fde047' ? `rgba(254, 240, 138, ${f.alpha * 0.8})` : `rgba(165, 243, 252, ${f.alpha * 0.8})`;
      ctx.fillRect(0, f.y + 4, canvasWidth, f.height - 8);

      ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
      ctx.fillRect(0, midY - 2, canvasWidth, 4);
    });

    this.shockwaves.forEach((sw) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(254, 240, 138, ${sw.alpha * 0.9})`;
      ctx.lineWidth = sw.lineWidth * (1 - sw.radius / sw.maxRadius) + 1;
      ctx.stroke();
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'lighter';
    this.particles.forEach((p) => {
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (let t = 0; t < p.trail.length; t++) {
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
        }
        ctx.strokeStyle = p.glowColor.replace(/[\d.]+\)$/, `${p.alpha * 0.75})`);
        ctx.lineWidth = Math.max(1, p.size * 0.9);
        ctx.stroke();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
      ctx.restore();
    });
    ctx.globalCompositeOperation = 'source-over';

    this.banners.forEach((b) => {
      ctx.save();
      ctx.translate(canvasWidth / 2, b.y);
      ctx.scale(b.scale, b.scale);

      ctx.font = '900 18px "Orbitron", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(254, 240, 138, ${b.alpha})`;
      ctx.fillText(b.text, 0, -4);

      ctx.font = '800 10px "Orbitron", monospace, sans-serif';
      ctx.fillStyle = `rgba(56, 189, 248, ${b.alpha})`;
      ctx.fillText(b.subtext, 0, 12);
      ctx.restore();
    });

    ctx.restore();
  }

  public clear() {
    this.particles = [];
    this.flashes = [];
    this.shockwaves = [];
    this.banners = [];
  }
}
