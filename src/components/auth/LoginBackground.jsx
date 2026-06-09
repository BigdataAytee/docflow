import { useEffect, useRef } from "react";

// Animated canvas: floating particles + flowing grid lines
export default function LoginBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let W = 0, H = 0;

    const PARTICLE_COUNT = 55;
    const particles = [];

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: randBetween(0, W),
          y: randBetween(0, H),
          r: randBetween(1, 3.5),
          vx: randBetween(-0.18, 0.18),
          vy: randBetween(-0.22, 0.22),
          alpha: randBetween(0.08, 0.45),
          hue: randBetween(210, 280), // indigo–violet range
        });
      }
    }

    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      t += 0.004;

      // ── animated mesh lines ──────────────────────────────────────
      const cols = 8, rows = 6;
      const cw = W / cols, ch = H / rows;
      ctx.lineWidth = 0.6;
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const ox = c * cw + Math.sin(t + r * 0.8) * 14;
          const oy = r * ch + Math.cos(t + c * 0.7) * 10;
          if (c < cols && r < rows) {
            const nx = (c + 1) * cw + Math.sin(t + (r) * 0.8) * 14;
            const ny = r * ch + Math.cos(t + (c + 1) * 0.7) * 10;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = `rgba(130,120,255,${0.04 + 0.03 * Math.sin(t + c + r)})`;
            ctx.stroke();
            const nx2 = c * cw + Math.sin(t + (r + 1) * 0.8) * 14;
            const ny2 = (r + 1) * ch + Math.cos(t + c * 0.7) * 10;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(nx2, ny2);
            ctx.stroke();
          }
        }
      }

      // ── floating particles ───────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const pulse = p.alpha * (0.7 + 0.3 * Math.sin(t * 2 + p.x));
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        grd.addColorStop(0, `hsla(${p.hue},80%,75%,${pulse})`);
        grd.addColorStop(1, `hsla(${p.hue},80%,75%,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // ── connect nearby particles ──────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(140,130,255,${0.12 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    initParticles();
    draw();

    const ro = new ResizeObserver(() => { resize(); initParticles(); });
    ro.observe(canvas);

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}