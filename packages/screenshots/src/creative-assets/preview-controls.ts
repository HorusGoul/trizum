import { renderHeaderScene } from "./header.ts";
import { normalizeArtwork } from "./svg.ts";

function element<T extends HTMLElement>(id: string, kind: { new (): T }): T {
  const value = document.getElementById(id);

  if (!(value instanceof kind)) throw new Error(`Missing preview element: ${id}`);

  return value;
}

const stage = element("stage", HTMLElement),
  slider = element("time", HTMLInputElement),
  play = element("play", HTMLButtonElement),
  clock = element("clock", HTMLOutputElement),
  language = element("language", HTMLSelectElement),
  framing = element("framing", HTMLSelectElement);

let time = 8.6,
  playing = false,
  poster = true,
  last = 0,
  lastPaint = 0;

function paint() {
  const crop = framing.value === "safe";
  stage.innerHTML = renderHeaderScene(time, language.value === "es" ? "es" : "en", crop);
  normalizeArtwork(stage);
  stage.style.aspectRatio = crop ? "1646 / 661" : "3840 / 1646";
  slider.value = String(time);
  clock.textContent = time.toFixed(1) + " / 20 s";
}

function stop() {
  playing = false;
  play.textContent = "Play";
  play.setAttribute("aria-label", "Play animation");
}

play.addEventListener("click", () => {
  if (playing) {
    stop();

    return;
  }

  if (poster || time > 19.95) {
    time = 0;
    poster = false;
  }

  playing = true;
  last = performance.now();
  play.textContent = "Pause";
  play.setAttribute("aria-label", "Pause animation");
});

slider.addEventListener("input", () => {
  stop();
  poster = false;
  time = Number(slider.value);
  paint();
});

framing.addEventListener("change", paint);

language.addEventListener("change", () => {
  stop();
  poster = false;
  time = 0;
  paint();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

function tick(now: number) {
  if (playing) {
    time = (time + (now - last) / 1000) % 20;

    if (now - lastPaint >= 1000 / 60) {
      paint();
      lastPaint = now;
    }
  }

  last = now;
  requestAnimationFrame(tick);
}

paint();

void document.fonts.ready.then(paint);

requestAnimationFrame(tick);
