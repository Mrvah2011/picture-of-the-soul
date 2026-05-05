'use strict';

// ===== GSAP Init =====
gsap.registerPlugin(ScrollTrigger);

// ===== Utils =====
const isTouchDevice = !window.matchMedia('(pointer: fine)').matches;
const isMobile      = window.matchMedia('(max-width: 768px)').matches;

// ===== Custom Cursor =====
if (!isTouchDevice) {
  const ring = document.getElementById('cursor-ring');
  const dot  = document.getElementById('cursor-dot');

  let mouseX = 0, mouseY = 0;
  let lastParticle = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.to(ring, { x: mouseX, y: mouseY, duration: .4, ease: 'power2.out' });
    gsap.to(dot,  { x: mouseX, y: mouseY, duration: .08 });
    if (Date.now() - lastParticle > 55) {
      spawnParticle(mouseX, mouseY);
      lastParticle = Date.now();
    }
  });

  const hoverEls = document.querySelectorAll('a, button, .service-card, .review-card, .gallery__slide, .form-check');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      gsap.to(ring, { scale: 1.7, borderColor: 'rgba(255,184,0,1)', duration: .25 });
      gsap.to(dot,  { scale: 0, duration: .2 });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(ring, { scale: 1, borderColor: 'rgba(255,184,0,0.7)', duration: .25 });
      gsap.to(dot,  { scale: 1, duration: .2 });
    });
  });

  function spawnParticle(x, y) {
    const colors = ['#FFB800', '#E29578', '#4361EE', '#FFD166'];
    const p = document.createElement('div');
    p.className = 'cursor-particle';
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[Math.floor(Math.random() * colors.length)]};`;
    document.body.appendChild(p);
    gsap.to(p, {
      x: (Math.random() - .5) * 90,
      y: (Math.random() - .5) * 90 - 20,
      opacity: 0,
      scale: 0,
      duration: .7 + Math.random() * .4,
      ease: 'power2.out',
      onComplete: () => p.remove()
    });
  }
}

// ===== Navigation =====
const nav       = document.getElementById('nav');
const burger    = document.getElementById('nav-burger');
const navLinks  = document.getElementById('nav-links');
const floatCTA  = document.getElementById('floating-cta');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 60);
  if (floatCTA) {
    const show = y > window.innerHeight * 0.55;
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

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// ===== Hero Reveal =====
gsap.timeline({ delay: .25 })
  .to('.hero__eyebrow', { opacity: 1, y: 0, duration: .7,  ease: 'power2.out' })
  .to('.hero__title',   { opacity: 1, y: 0, duration: .85, ease: 'power2.out' }, '-=.45')
  .to('.hero__sub',     { opacity: 1, y: 0, duration: .65, ease: 'power2.out' }, '-=.45')
  .to('.hero .btn',     { opacity: 1, y: 0, duration: .55, ease: 'power2.out' }, '-=.35');

// ===== Video Scrubbing =====
if (!isMobile) {
  const scrollVideo = document.getElementById('scroll-video');
  const phases      = document.querySelectorAll('.scroll-phase');
  const progressEl  = document.createElement('div');

  progressEl.className = 'scroll-progress';
  [0,1,2].forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'scroll-progress__dot' + (i === 0 ? ' active' : '');
    progressEl.appendChild(d);
  });
  document.body.appendChild(progressEl);

  const progressDots = progressEl.querySelectorAll('.scroll-progress__dot');

  function setPhase(index) {
    phases.forEach((p, i) => p.classList.toggle('active', i === index));
    progressDots.forEach((d, i) => d.classList.toggle('active', i === index));
  }
  setPhase(0);

  scrollVideo.addEventListener('loadedmetadata', () => {
    scrollVideo.pause();
    scrollVideo.currentTime = 0;
  });

  let raf;
  let targetTime = 0;

  ScrollTrigger.create({
    trigger: '.scrollytelling',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onEnter:      () => progressEl.classList.add('visible'),
    onLeave:      () => progressEl.classList.remove('visible'),
    onEnterBack:  () => progressEl.classList.add('visible'),
    onLeaveBack:  () => progressEl.classList.remove('visible'),
    onUpdate: (self) => {
      if (scrollVideo.duration) {
        targetTime = scrollVideo.duration * self.progress;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          scrollVideo.currentTime = targetTime;
        });
      }
      const idx = Math.min(2, Math.floor(self.progress * 3));
      setPhase(idx);
    }
  });
}

// ===== Scroll Reveal =====
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ===== Carousel Factory =====
function createCarousel(opts) {
  const { track, prevBtn, nextBtn, dotsContainer, visibleCount } = opts;
  const slides = Array.from(track.children);
  let current = 0;

  function getSlideWidth() {
    if (!slides[0]) return 0;
    return slides[0].offsetWidth + 16; // gap: 16px
  }

  function maxIndex() {
    return Math.max(0, slides.length - visibleCount());
  }

  function update(animated) {
    const x = -current * getSlideWidth();
    if (animated === false) {
      gsap.set(track, { x });
    } else {
      gsap.to(track, { x, duration: .42, ease: 'power2.inOut' });
    }
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.gallery__dot, .reviews__dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    }
  }

  function go(dir) {
    current = Math.max(0, Math.min(current + dir, maxIndex()));
    update();
  }

  if (prevBtn) prevBtn.addEventListener('click', () => go(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(1));

  // Touch / swipe
  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 44) go(diff > 0 ? 1 : -1);
  }, { passive: true });

  // Drag (mouse)
  let dragging = false, dragStartX = 0, dragStartCurrent = 0;
  track.addEventListener('mousedown', e => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartCurrent = current;
    track.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    track.style.cursor = '';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const diff = dragStartX - e.clientX;
    if (Math.abs(diff) > 50) {
      current = Math.max(0, Math.min(dragStartCurrent + (diff > 0 ? 1 : -1), maxIndex()));
      update();
      dragging = false;
    }
  });

  // Build dots
  if (dotsContainer) {
    const dotClass = dotsContainer.id === 'gallery-dots' ? 'gallery__dot' : 'reviews__dot';
    const total = maxIndex() + 1;
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className = dotClass + (i === 0 ? ' active' : '');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', `Слайд ${i + 1}`);
      d.addEventListener('click', () => { current = i; update(); });
      dotsContainer.appendChild(d);
    }
  }

  window.addEventListener('resize', () => update(false), { passive: true });

  return { go, update };
}

// ===== Gallery Carousel =====
const galleryTrack = document.getElementById('gallery-track');
if (galleryTrack) {
  createCarousel({
    track: galleryTrack,
    prevBtn: document.getElementById('gallery-prev'),
    nextBtn: document.getElementById('gallery-next'),
    dotsContainer: document.getElementById('gallery-dots'),
    visibleCount: () => window.innerWidth < 600 ? 1 : window.innerWidth < 1024 ? 2 : 3
  });
}

// ===== Reviews Carousel =====
const reviewsTrack = document.getElementById('reviews-track');
if (reviewsTrack) {
  createCarousel({
    track: reviewsTrack,
    prevBtn: document.getElementById('reviews-prev'),
    nextBtn: document.getElementById('reviews-next'),
    dotsContainer: document.getElementById('reviews-dots'),
    visibleCount: () => window.innerWidth < 600 ? 1 : window.innerWidth < 1024 ? 2 : 3
  });
}

// ===== Form Submission =====
const form = document.getElementById('lead-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    let valid = true;

    const nameEl = form.querySelector('[name="name"]');
    const tgEl   = form.querySelector('[name="telegram"]');
    if (!nameEl.value.trim()) {
      nameEl.closest('.form-field').classList.add('error');
      valid = false;
    }
    if (!tgEl.value.trim()) {
      tgEl.closest('.form-field').classList.add('error');
      valid = false;
    }
    form.querySelectorAll('[name="privacy"], [name="personal_data"]').forEach(cb => {
      if (!cb.checked) {
        cb.closest('.form-check').classList.add('error');
        valid = false;
      }
    });

    if (!valid) return;

    const submitBtn = document.getElementById('form-submit');
    const successEl = document.getElementById('form-success');
    const errorEl   = document.getElementById('form-error');

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn__text').textContent = 'Отправляем…';

    try {
      const payload = {
        name:     nameEl.value.trim(),
        telegram: tgEl.value.trim(),
        phone:    (form.querySelector('[name="phone"]')?.value || '').trim()
      };

      const res = await fetch('/api/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });

      if (res.ok) {
        form.reset();
        successEl.hidden = false;
        errorEl.hidden   = true;
        gsap.fromTo(successEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
        successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        throw new Error('server');
      }
    } catch {
      errorEl.hidden   = false;
      successEl.hidden = true;
      gsap.fromTo(errorEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 });
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn__text').textContent = 'Записаться на сессию';
    }
  });

  function clearErrors() {
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.getElementById('form-success').hidden = true;
    document.getElementById('form-error').hidden   = true;
  }

  form.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      input.closest('.form-field, .form-check')?.classList.remove('error');
    });
    input.addEventListener('change', () => {
      input.closest('.form-field, .form-check')?.classList.remove('error');
    });
  });
}

// ===== Smooth Anchor Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  });
});
