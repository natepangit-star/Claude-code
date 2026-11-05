// A small player that shows either the uploaded video or (for demo data)
// a rendered stick figure, with the detected skeleton overlaid.
import { drawSkeleton, nearestFrame } from './skeleton.js';
import { t } from './i18n.js';

export class Player {
  /**
   * @param {HTMLElement} root container to render into
   * @param {{frames:Array, aspect:number, hand:string, video?:HTMLVideoElement, offset?:number}} src
   */
  constructor(root, { frames, aspect, hand, video = null, offset = 0 }) {
    this.frames = frames;
    this.aspect = aspect;
    this.hand = hand;
    this.video = video;
    this.offset = offset;
    this.duration = frames.length ? frames[frames.length - 1].t : 0;
    this.t = 0;
    this.playing = false;
    this.rate = 1;
    this.showSkeleton = true;
    this.listeners = [];

    root.innerHTML = `
      <div class="player-stage" style="aspect-ratio:${aspect}">
        <canvas class="player-canvas"></canvas>
      </div>
      <div class="player-controls">
        <button class="btn icon play" aria-label="${t('Play')}">▶</button>
        <input class="scrub" type="range" min="0" max="${this.duration}" step="0.01" value="0" aria-label="${t('Seek')}" />
        <span class="time">0.00s</span>
        <select class="speed" aria-label="${t('Playback speed')}">
          <option value="0.25">0.25×</option><option value="0.5" selected>0.5×</option><option value="1">1×</option>
        </select>
        <label class="toggle"><input type="checkbox" class="skel" checked /> ${t('Skeleton')}</label>
      </div>`;
    this.stage = root.querySelector('.player-stage');
    this.canvas = root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.btn = root.querySelector('.play');
    this.scrub = root.querySelector('.scrub');
    this.timeEl = root.querySelector('.time');
    this.rate = 0.5;
    if (video) {
      video.className = 'player-video';
      video.controls = false;
      this.stage.prepend(video);
      video.playbackRate = this.rate;
      video.addEventListener('timeupdate', () => this.#fromVideo());
      video.addEventListener('ended', () => this.pause());
    }
    this.btn.onclick = () => (this.playing ? this.pause() : this.play());
    this.scrub.oninput = () => this.seek(Number(this.scrub.value));
    root.querySelector('.speed').onchange = (e) => {
      this.rate = Number(e.target.value);
      if (video) video.playbackRate = this.rate;
    };
    root.querySelector('.skel').onchange = (e) => { this.showSkeleton = e.target.checked; this.render(); };
    this.ro = new ResizeObserver(() => this.#resize());
    this.ro.observe(this.stage);
    this.#resize();
  }

  onTime(cb) { this.listeners.push(cb); }

  #emit() {
    this.scrub.value = this.t;
    this.timeEl.textContent = `${this.t.toFixed(2)}s`;
    for (const cb of this.listeners) cb(this.t);
  }

  #resize() {
    const r = this.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.render();
  }

  #fromVideo() {
    if (!this.video) return;
    this.t = Math.max(0, this.video.currentTime - this.offset);
    if (this.t >= this.duration) { this.video.pause(); this.playing = false; this.btn.textContent = '▶'; }
    this.render();
    this.#emit();
  }

  seek(t) {
    this.t = Math.max(0, Math.min(this.duration, t));
    if (this.video) this.video.currentTime = this.t + this.offset;
    this.render();
    this.#emit();
  }

  play() {
    if (this.t >= this.duration - 0.01) this.seek(0);
    this.playing = true;
    this.btn.textContent = '❚❚';
    this.btn.setAttribute('aria-label', t('Pause'));
    if (this.video) {
      this.video.play();
      const loop = () => { if (!this.playing) return; this.#fromVideo(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      return;
    }
    let last = performance.now();
    const loop = (now) => {
      if (!this.playing) return;
      this.t += ((now - last) / 1000) * this.rate;
      last = now;
      if (this.t >= this.duration) { this.t = this.duration; this.pause(); }
      this.render();
      this.#emit();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  pause() {
    this.playing = false;
    this.btn.textContent = '▶';
    this.btn.setAttribute('aria-label', t('Play'));
    this.video?.pause();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.video) paintCourt(ctx, canvas.width, canvas.height);
    if (this.showSkeleton || !this.video) {
      const f = nearestFrame(this.frames, this.t);
      drawSkeleton(ctx, f?.lm, canvas.width, canvas.height, { hand: this.hand });
    }
  }

  /** Render a still of time t (video frame + skeleton) as a JPEG data URL. */
  async snapshot(t, width = 360) {
    const h = Math.round(width / this.aspect);
    const c = document.createElement('canvas');
    c.width = width; c.height = h;
    const ctx = c.getContext('2d');
    if (this.video) {
      await new Promise((res) => {
        const done = () => { this.video.removeEventListener('seeked', done); res(); };
        this.video.addEventListener('seeked', done);
        this.video.currentTime = t + this.offset;
      });
      ctx.drawImage(this.video, 0, 0, width, h);
    } else {
      paintCourt(ctx, width, h);
    }
    drawSkeleton(ctx, nearestFrame(this.frames, t)?.lm, width, h, { hand: this.hand, lineWidth: 3 });
    return c.toDataURL('image/jpeg', 0.75);
  }

  destroy() {
    this.pause();
    this.ro.disconnect();
  }
}

function paintCourt(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1b2433');
  g.addColorStop(1, '#2a1f17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5a3d27';
  ctx.fillRect(0, h * 0.89, w, h * 0.11);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = Math.max(1, h / 300);
  ctx.beginPath(); ctx.moveTo(0, h * 0.89); ctx.lineTo(w, h * 0.89); ctx.stroke();
}
