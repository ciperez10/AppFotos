import { defaultCorners } from '../image/edge-detection.js';

const LABELS = ['1', '2', '3', '4'];

export class CropEditor {
  constructor(canvas, onChange = () => {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onChange = onChange; this.source = null; this.corners = []; this.dragIndex = -1;
    canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    canvas.addEventListener('pointermove', event => this.pointerMove(event));
    ['pointerup', 'pointercancel'].forEach(type => canvas.addEventListener(type, event => this.pointerUp(event)));
  }
  setSource(source) { this.source = source; this.canvas.width = source.width; this.canvas.height = source.height; this.reset(); }
  setCorners(corners, mode = 'manual') { this.corners = corners.map(p => ({ ...p })); this.mode = mode; this.draw(); this.onChange(this.getCorners(), mode); }
  reset() { if (this.source) this.setCorners(defaultCorners(this.source.width, this.source.height), 'manual'); }
  getCorners() { return this.corners.map(p => ({ ...p })); }
  point(event) { const rect = this.canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * this.canvas.width / rect.width, y: (event.clientY - rect.top) * this.canvas.height / rect.height }; }
  pointerDown(event) { const p = this.point(event), radius = Math.max(28, this.canvas.width * .035); let best = -1, distance = Infinity; this.corners.forEach((corner, i) => { const d = Math.hypot(p.x - corner.x, p.y - corner.y); if (d < distance && d < radius) { best = i; distance = d; } }); if (best >= 0) { this.dragIndex = best; this.canvas.setPointerCapture(event.pointerId); event.preventDefault(); } }
  pointerMove(event) { if (this.dragIndex < 0) return; const p = this.point(event), margin = 2; this.corners[this.dragIndex] = { x: Math.max(margin, Math.min(this.canvas.width - margin, p.x)), y: Math.max(margin, Math.min(this.canvas.height - margin, p.y)) }; this.mode = 'manual'; this.draw(); this.onChange(this.getCorners(), this.mode); event.preventDefault(); }
  pointerUp(event) { if (this.dragIndex >= 0 && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); this.dragIndex = -1; }
  draw() {
    if (!this.source) return; const { ctx, canvas, corners } = this; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(this.source, 0, 0);
    ctx.save(); ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height); ctx.moveTo(corners[0].x, corners[0].y); corners.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill('evenodd');
    ctx.strokeStyle = this.mode === 'automatic' ? '#65f5b9' : '#0AAEF3'; ctx.lineWidth = Math.max(4, canvas.width * .004); ctx.lineJoin = 'round'; ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    const radius = Math.max(14, canvas.width * .015); corners.forEach((p, i) => { ctx.fillStyle = 'white'; ctx.strokeStyle = '#0AAEF3'; ctx.lineWidth = Math.max(3, radius * .18); ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#0E1F53'; ctx.font = `900 ${Math.round(radius)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LABELS[i], p.x, p.y + 1); }); ctx.restore();
  }
  destroy() { this.source = null; this.corners = []; this.canvas.width = 1; this.canvas.height = 1; }
}
