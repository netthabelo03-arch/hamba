// Crop a product photo to a square after the seller picks it, so every photo
// fits the product cards neatly. Drag to move, pinch or use the slider to zoom.
// Zooming all the way out shows the whole photo on a white background.

import { el } from '../dom.js';

export const OUTPUT_SIZE = 1200;

/**
 * Where the photo sits in the square, kept so the square is always covered
 * when zoomed in, and centred when zoomed out past "cover".
 * @returns {{ x: number, y: number }} top-left of the drawn photo, in frame pixels
 */
export function clampOffset({ x, y }, drawnWidth, drawnHeight, frame) {
  const fit = (pos, size) => (size <= frame ? (frame - size) / 2 : Math.min(0, Math.max(frame - size, pos)));
  return { x: fit(x, drawnWidth), y: fit(y, drawnHeight) };
}

/** Zoom limits: from showing the whole photo (contain) up to 4× the cover zoom. */
export function zoomLimits(width, height, frame) {
  const contain = frame / Math.max(width, height);
  const cover = frame / Math.min(width, height);
  return { min: contain, cover, max: cover * 4 };
}

/**
 * Show the cropper for one photo.
 * @param {Blob} file
 * @returns {Promise<Blob | null>} the square JPEG, or null if the seller cancelled
 */
export async function cropPhoto(file) {
  const bitmap = await createImageBitmap(file);
  return new Promise((resolve) => {
    const frame = Math.min(window.innerWidth - 40, 420);
    const limits = zoomLimits(bitmap.width, bitmap.height, frame);
    let scale = limits.cover;
    let offset = clampOffset({ x: (frame - bitmap.width * scale) / 2, y: (frame - bitmap.height * scale) / 2 }, bitmap.width * scale, bitmap.height * scale, frame);

    const ratio = window.devicePixelRatio || 1;
    const canvas = el('canvas', { class: 'cropper__canvas', width: String(Math.round(frame * ratio)), height: String(Math.round(frame * ratio)), tabindex: '0', 'aria-label': 'Photo. Drag or use the arrow keys to move it; plus and minus to zoom.' });
    canvas.style.width = `${frame}px`;
    canvas.style.height = `${frame}px`;
    const context = canvas.getContext('2d');

    const slider = el('input', { type: 'range', class: 'cropper__zoom', min: '0', max: '1000', 'aria-label': 'Zoom' });
    const toSlider = (s) => String(Math.round(((Math.log(s) - Math.log(limits.min)) / (Math.log(limits.max) - Math.log(limits.min))) * 1000));
    const fromSlider = (v) => Math.exp(Math.log(limits.min) + (Number(v) / 1000) * (Math.log(limits.max) - Math.log(limits.min)));
    slider.value = toSlider(scale);

    function draw() {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, frame, frame);
      context.drawImage(bitmap, offset.x, offset.y, bitmap.width * scale, bitmap.height * scale);
    }
    function zoomTo(next, centreX = frame / 2, centreY = frame / 2) {
      const clamped = Math.min(limits.max, Math.max(limits.min, next));
      // Keep the point under the fingers (or the centre) still while zooming.
      const px = (centreX - offset.x) / scale;
      const py = (centreY - offset.y) / scale;
      scale = clamped;
      offset = clampOffset({ x: centreX - px * scale, y: centreY - py * scale }, bitmap.width * scale, bitmap.height * scale, frame);
      slider.value = toSlider(scale);
      draw();
    }
    function moveBy(dx, dy) {
      offset = clampOffset({ x: offset.x + dx, y: offset.y + dy }, bitmap.width * scale, bitmap.height * scale, frame);
      draw();
    }

    // Drag with one finger or the mouse; pinch with two fingers.
    const pointers = new Map();
    let pinchStart = null;
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && pinchStart) {
        const [a, b] = [...pointers.values()];
        const rect = canvas.getBoundingClientRect();
        zoomTo(pinchStart.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.distance), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      } else if (pointers.size === 1) {
        moveBy(event.clientX - last.x, event.clientY - last.y);
      }
    });
    const release = (event) => { pointers.delete(event.pointerId); if (pointers.size < 2) pinchStart = null; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomTo(scale * (event.deltaY < 0 ? 1.08 : 1 / 1.08), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
    canvas.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 40 : 10;
      const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[event.key]) { event.preventDefault(); moveBy(...moves[event.key]); }
      if (event.key === '+' || event.key === '=') zoomTo(scale * 1.1);
      if (event.key === '-') zoomTo(scale / 1.1);
    });
    slider.addEventListener('input', () => zoomTo(fromSlider(slider.value)));

    const whole = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Show whole photo' });
    whole.addEventListener('click', () => zoomTo(limits.min));
    const fill = el('button', { type: 'button', class: 'button button--quiet button--small', text: 'Fill the square' });
    fill.addEventListener('click', () => zoomTo(limits.cover));
    const cancel = el('button', { type: 'button', class: 'button button--quiet', text: 'Cancel' });
    const use = el('button', { type: 'button', class: 'button button--primary', text: 'Use photo' });

    const dialog = el('div', { class: 'cropper', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cropper-title' }, [
      el('div', { class: 'cropper__panel' }, [
        el('h2', { class: 'section-title', id: 'cropper-title', text: 'Crop your photo' }),
        el('p', { class: 'field__hint', text: 'Drag to move. Pinch or slide to zoom. Keep the product in the middle.' }),
        el('div', { class: 'cropper__frame' }, [canvas]),
        el('div', { class: 'cropper__row' }, [el('span', { class: 'cropper__icon', 'aria-hidden': 'true', text: '−' }), slider, el('span', { class: 'cropper__icon', 'aria-hidden': 'true', text: '+' })]),
        el('div', { class: 'cropper__row' }, [whole, fill]),
        el('div', { class: 'cropper__actions' }, [cancel, use]),
      ]),
    ]);

    const before = document.activeElement;
    function close(result) {
      document.removeEventListener('keydown', onEscape);
      dialog.remove();
      bitmap.close?.();
      before?.focus?.();
      resolve(result);
    }
    function onEscape(event) {
      if (event.key === 'Escape') close(null);
    }
    cancel.addEventListener('click', () => close(null));
    use.addEventListener('click', () => {
      const out = document.createElement('canvas');
      out.width = OUTPUT_SIZE;
      out.height = OUTPUT_SIZE;
      const c = out.getContext('2d');
      const k = OUTPUT_SIZE / frame;
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      c.drawImage(bitmap, offset.x * k, offset.y * k, bitmap.width * scale * k, bitmap.height * scale * k);
      out.toBlob((blob) => close(blob), 'image/jpeg', 0.86);
    });
    document.addEventListener('keydown', onEscape);
    document.body.append(dialog);
    draw();
    canvas.focus();
  });
}
