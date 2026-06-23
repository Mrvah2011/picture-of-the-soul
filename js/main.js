'use strict';

gsap.registerPlugin(ScrollTrigger);

/* ===== Helpers ===== */
const isTouchDevice = !window.matchMedia('(pointer: fine)').matches;
const isMobile      = window.matchMedia('(max-width: 768px)').matches;

/* ===== Custom Cursor ===== */
if (!isTouchDevice) {
  const ring = document.getElementById('cursor-ring');
  const dot  = document.getElementById('cursor-dot');
  let lastParticle = 0;
  let cursorVisible = false;

  // GSAP controls all transforms — xPercent/yPercent handle centering
  gsap.set(ring, { xPercent: -50, yPercent: -50 });
  gsap.set(dot,  { xPercent: -50, yPercent: -50 });

  document.addEventListener('mousemove', (e) => {
    // Reveal cursor on first move (avoids flash at 0,0 on load)
    if (!cursorVisible) {
      gsap.to([ring, dot], { opacity: 1, duration: .25 });
      cursorVisible = true;
    }
    gsap.to(ring, { x: e.clientX, y: e.clientY, duration: .38, ease: 'power2.out' });
    gsap.to(dot,  { x: e.clientX, y: e.clientY, duration: .08 });
    if (Date.now() - lastParticle > 60) { spawnParticle(e.clientX, e.clientY); lastParticle = Date.now(); }
  });

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => gsap.to([ring, dot], { opacity: 0, duration: .2 }));
  document.addEventListener('mouseenter', () => { if (cursorVisible) gsap.to([ring, dot], { opacity: 1, duration: .2 }); });

  document.querySelectorAll('a, button, .service-card, .review-card, .gallery__slide, .form-check, .session-radio, .pricing__card').forEach(el => {
    el.addEventListener('mouseenter', () => { gsap.to(ring, { scale: 1.7, borderColor: 'rgba(255,184,0,1)', duration: .25 }); gsap.to(dot, { scale: 0, duration: .2 }); });
    el.addEventListener('mouseleave', () => { gsap.to(ring, { scale: 1, borderColor: 'rgba(255,184,0,0.7)', duration: .25 }); gsap.to(dot, { scale: 1, duration: .2 }); });
  });

  function spawnParticle(x, y) {
    const colors = ['#FFB800', '#E29578', '#4361EE', '#FFD166'];
    const p = document.createElement('div');
    p.className = 'cursor-particle';
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[Math.floor(Math.random() * 4)]};`;
    document.body.appendChild(p);
    gsap.to(p, { x: (Math.random()-.5)*90, y: (Math.random()-.5)*90-20, opacity: 0, scale: 0, duration: .65+Math.random()*.4, ease: 'power2.out', onComplete: () => p.remove() });
  }
}

/* ===== Navigation ===== */
const nav      = document.getElementById('nav');
const burger   = document.getElementById('nav-burger');
const navLinks = document.getElementById('nav-links');
const floatCTA = document.getElementById('floating-cta');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 60);
  if (floatCTA) {
    const show = y > window.innerHeight * 0.6;
    floatCTA.classList.toggle('visible', show);
    floatCTA.setAttribute('aria-hidden', String(!show));
    floatCTA.querySelector('a').tabIndex = show ? 0 : -1;
  }
}, { passive: true });

burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open'); burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

/* ===== Story: Hero reveal on load ===== */
gsap.timeline({ delay: .2 })
  .to('.story__eyebrow',    { opacity: 1, y: 0, duration: .7,  ease: 'power2.out' })
  .to('.story__hero-title', { opacity: 1, y: 0, duration: .85, ease: 'power2.out' }, '-=.45')
  .to('.story__hero-sub',   { opacity: 1, y: 0, duration: .65, ease: 'power2.out' }, '-=.45')
  .to('.story__phase[data-phase="0"] .btn', { opacity: 1, y: 0, duration: .55, ease: 'power2.out' }, '-=.35');

/* ===== Story elements initial state ===== */
gsap.set('.story__eyebrow',    { opacity: 0, y: 16 });
gsap.set('.story__hero-title', { opacity: 0, y: 24 });
gsap.set('.story__hero-sub',   { opacity: 0, y: 16 });
gsap.set('.story__phase[data-phase="0"] .btn', { opacity: 0, y: 16 });

/* ===== Story Video Scrubbing (desktop only) ===== */
if (!isMobile) {
  const video      = document.getElementById('story-video');
  const phases     = document.querySelectorAll('.story__phase');
  const dots       = document.querySelectorAll('.story__dot');
  const scrollHint = document.getElementById('story-hint');

  // Phase breakpoints: 0–20% hero, 20–47% finance, 47–73% relations, 73–100% codes
  const BREAKS = [0, 0.20, 0.47, 0.73, 1.0];
  let currentPhase = 0;
  let targetTime   = 0;
  let rafPending   = false;
  let videoReady   = false;

  // Autoplay → show first frame → immediately pause, then scroll controls
  function pauseAtStart() {
    video.pause();
    video.currentTime = 0;
    videoReady = true;
  }
  video.addEventListener('canplay',        pauseAtStart, { once: true });
  video.addEventListener('loadedmetadata', () => {
    // Ensure we can seek from the beginning
    if (video.currentTime !== 0) video.currentTime = 0;
  });

  function setPhase(idx) {
    if (idx === currentPhase) return;
    currentPhase = idx;
    phases.forEach((p, i) => p.classList.toggle('active', i === idx));
    dots.forEach((d, i)   => d.classList.toggle('active', i === idx));
  }
  setPhase(0);

  function seekVideo() {
    if (video.readyState >= 2 && video.duration) {
      video.currentTime = targetTime;
    }
    rafPending = false;
  }

  ScrollTrigger.create({
    trigger: '.story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.8,                 // lag in seconds → smooths out seeking
    onUpdate: (self) => {
      const p = self.progress;

      // Video scrub (throttled via rAF)
      if (video.duration) {
        targetTime = video.duration * p;
        if (!rafPending) { rafPending = true; requestAnimationFrame(seekVideo); }
      }

      // Phase detection
      let idx = 0;
      for (let i = 0; i < BREAKS.length - 1; i++) {
        if (p >= BREAKS[i]) idx = i;
      }
      setPhase(idx);

      // Hide scroll hint after first phase
      if (scrollHint) scrollHint.classList.toggle('hidden', p > 0.05);
    }
  });
}

/* ===== Pricing buttons pre-select form ===== */
document.querySelectorAll('.pricing__btn[data-session]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.session === 'group'
      ? 'Групповое — 6 200 ₽'
      : 'Индивидуальное — 24 000 ₽';
    const radio = document.querySelector(`input[name="session_type"][value="${type}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
});

/* ===== Scroll Reveal ===== */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ===== Carousel Factory ===== */
function createCarousel({ track, prevBtn, nextBtn, dotsContainer, visibleCount, dotClass }) {
  const slides = Array.from(track.children);
  let current = 0;

  function slideWidth()  { return slides[0] ? slides[0].offsetWidth + 16 : 0; }
  function maxIdx()      { return Math.max(0, slides.length - visibleCount()); }

  function update(animated = true) {
    const x = -current * slideWidth();
    animated ? gsap.to(track, { x, duration: .42, ease: 'power2.inOut' }) : gsap.set(track, { x });
    dotsContainer?.querySelectorAll('.' + dotClass).forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function go(dir) { current = Math.max(0, Math.min(current + dir, maxIdx())); update(); }

  prevBtn?.addEventListener('click', () => go(-1));
  nextBtn?.addEventListener('click', () => go(1));

  // Touch
  let tx = 0;
  track.addEventListener('touchstart', e => tx = e.touches[0].clientX, { passive: true });
  track.addEventListener('touchend',   e => { if (Math.abs(tx - e.changedTouches[0].clientX) > 44) go(tx > e.changedTouches[0].clientX ? 1 : -1); }, { passive: true });

  // Drag (desktop)
  let dragging = false, dragX = 0, dragC = 0;
  track.addEventListener('mousedown',  e => { dragging = true; dragX = e.clientX; dragC = current; track.style.userSelect = 'none'; });
  window.addEventListener('mouseup',   ()  => { dragging = false; track.style.userSelect = ''; });
  window.addEventListener('mousemove', e  => {
    if (!dragging) return;
    if (Math.abs(dragX - e.clientX) > 50) { current = Math.max(0, Math.min(dragC + (dragX > e.clientX ? 1 : -1), maxIdx())); update(); dragging = false; }
  });

  // Dots
  if (dotsContainer) {
    const total = maxIdx() + 1;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = dotClass + (i === 0 ? ' active' : '');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', `Слайд ${i+1}`);
      d.addEventListener('click', () => { current = i; update(); });
      dotsContainer.appendChild(d);
    }
  }

  window.addEventListener('resize', () => update(false), { passive: true });
}

/* Gallery */
const gt = document.getElementById('gallery-track');
if (gt) {
  /* Gallery video slides — first frame + play button */
  gt.querySelectorAll('.gallery__slide--video').forEach(slide => {
    const video  = slide.querySelector('video');
    const playBtn = slide.querySelector('.gallery__play-btn');

    // Seek to first frame as soon as metadata is ready
    video.addEventListener('loadedmetadata', () => { video.currentTime = 0.01; }, { once: true });

    // Play button click
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.play();
        playBtn.classList.add('hidden');
        slide.classList.add('playing');
      });
    }

    // Pause on slide click when playing
    slide.addEventListener('click', () => {
      if (!video.paused) {
        video.pause();
        if (playBtn) playBtn.classList.remove('hidden');
        slide.classList.remove('playing');
      }
    });

    // Restore play button when video ends
    video.addEventListener('ended', () => {
      slide.classList.remove('playing');
      if (playBtn) playBtn.classList.remove('hidden');
      video.currentTime = 0.01;
    });
  });

  createCarousel({
    track: gt,
    prevBtn: document.getElementById('gallery-prev'),
    nextBtn: document.getElementById('gallery-next'),
    dotsContainer: document.getElementById('gallery-dots'),
    dotClass: 'gallery__dot',
    visibleCount: () => window.innerWidth < 600 ? 1 : window.innerWidth < 1024 ? 2 : 3
  });
}

/* ===== Review Video ===== */
const reviewVideo   = document.getElementById('review-video');
const reviewPlayBtn = document.getElementById('review-play-btn');
if (reviewVideo && reviewPlayBtn) {
  // Show first frame as poster
  reviewVideo.addEventListener('loadedmetadata', () => { reviewVideo.currentTime = 0.01; }, { once: true });

  reviewPlayBtn.addEventListener('click', () => {
    reviewVideo.play();
    reviewPlayBtn.classList.add('hidden');
  });

  reviewVideo.addEventListener('ended', () => {
    reviewPlayBtn.classList.remove('hidden');
    reviewVideo.currentTime = 0.01;
  });

  // Clicking video while playing → pause and show button
  reviewVideo.addEventListener('click', () => {
    if (!reviewVideo.paused) {
      reviewVideo.pause();
      reviewPlayBtn.classList.remove('hidden');
    }
  });
}

/* Reviews */
const rt = document.getElementById('reviews-track');
if (rt) {
  createCarousel({
    track: rt,
    prevBtn: document.getElementById('reviews-prev'),
    nextBtn: document.getElementById('reviews-next'),
    dotsContainer: document.getElementById('reviews-dots'),
    dotClass: 'reviews__dot',
    visibleCount: () => window.innerWidth < 600 ? 1 : window.innerWidth < 1024 ? 2 : 3
  });
}

/* ===== Form ===== */
const form = document.getElementById('lead-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    let valid = true;
    const nameEl  = form.querySelector('[name="name"]');
    const phoneEl = form.querySelector('[name="phone"]');
    if (!nameEl.value.trim())  { nameEl.closest('.form-field').classList.add('error');  valid = false; }
    if (!phoneEl.value.trim()) { phoneEl.closest('.form-field').classList.add('error'); valid = false; }
    form.querySelectorAll('[name="privacy"],[name="personal_data"]').forEach(cb => {
      if (!cb.checked) { cb.closest('.form-check').classList.add('error'); valid = false; }
    });
    if (!valid) return;

    const btn       = document.getElementById('form-submit');
    const successEl = document.getElementById('form-success');
    const errorEl   = document.getElementById('form-error');
    const sessionRadio = form.querySelector('[name="session_type"]:checked');

    btn.disabled = true;
    btn.querySelector('.btn__text').textContent = 'Отправляем…';

    try {
      const payload = {
        name:         nameEl.value.trim(),
        phone:        phoneEl.value.trim(),
        session_type: sessionRadio?.value || 'Не указан'
      };

      const res = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        form.reset();

        if (data.paymentUrl) {
          // Show redirect message, then go to T-Bank payment page
          successEl.hidden = false; errorEl.hidden = true;
          successEl.querySelector('p').textContent = 'Заявка принята! Переходим к оплате…';
          gsap.fromTo(successEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
          btn.querySelector('.btn__text').textContent = 'Переходим к оплате…';
          setTimeout(() => { window.location.href = data.paymentUrl; }, 1800);
          return; // skip finally reset of button text
        } else {
          successEl.hidden = false; errorEl.hidden = true;
          gsap.fromTo(successEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
          successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else { throw new Error(); }
    } catch {
      errorEl.hidden = false; successEl.hidden = true;
      gsap.fromTo(errorEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn__text').textContent = 'Записаться на сессию';
    }
  });

  function clearErrors() {
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.getElementById('form-success').hidden = true;
    document.getElementById('form-error').hidden   = true;
  }
  form.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input',  () => inp.closest('.form-field,.form-check')?.classList.remove('error'));
    inp.addEventListener('change', () => inp.closest('.form-field,.form-check')?.classList.remove('error'));
  });
}

/* ===== Payment result handling (return from T-Bank) ===== */
(function () {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (!payment) return;

  // Remove ?payment= from URL without reload
  history.replaceState(null, '', window.location.pathname);

  const overlay = document.createElement('div');
  overlay.id = 'payment-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99999',
    'display:flex;flex-direction:column;align-items:center;justify-content:center',
    'background:rgba(10,10,11,.96);backdrop-filter:blur(20px)',
    'padding:32px;text-align:center'
  ].join(';');

  const isSuccess = payment === 'success';
  overlay.innerHTML = `
    <div style="font-size:64px;margin-bottom:20px">${isSuccess ? '✅' : '❌'}</div>
    <h2 style="font-family:Georgia,serif;color:#F5F0E8;font-size:clamp(22px,4vw,36px);margin:0 0 12px">
      ${isSuccess ? 'Оплата прошла успешно!' : 'Оплата не прошла'}
    </h2>
    <p style="color:rgba(245,240,232,.65);font-size:16px;max-width:420px;margin:0 0 32px;line-height:1.6">
      ${isSuccess
        ? 'Спасибо! Светлана свяжется с вами в ближайшее время для подтверждения записи.'
        : 'Что-то пошло не так. Попробуйте ещё раз или напишите напрямую в Telegram.'}
    </p>
    ${isSuccess
      ? `<a href="https://t.me/svetlanayuzmieva" target="_blank" rel="noopener"
           style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;border-radius:50px;
                  background:linear-gradient(135deg,#FFB800,#E29578);color:#0A0A0B;font-weight:700;
                  font-size:15px;text-decoration:none">
           ✈️ Написать Светлане
         </a>`
      : `<button onclick="document.getElementById('payment-overlay').remove()"
           style="padding:14px 32px;border-radius:50px;border:1.5px solid rgba(255,184,0,.6);
                  color:#FFB800;font-weight:700;font-size:15px;cursor:pointer;background:none">
           ← Вернуться на сайт
         </button>`}
  `;

  document.body.appendChild(overlay);
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });

  // Close on click outside content (success only after 3s)
  if (!isSuccess) {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }
})();

/* ===== Smooth anchor scroll ===== */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  });
});
