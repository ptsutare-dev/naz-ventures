// ============================================
// Naz Ventures — shared site script
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  setActiveNavLink();
  initReveal();
  initFooterYear();
  initContactForm();
  initVenturePreselect();
});

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function setActiveNavLink() {
  const current = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[data-page]').forEach((link) => {
    if (link.dataset.page === current) {
      link.classList.add('active');
    }
  });
}

function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach((el) => observer.observe(el));
}

function initFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('form-status');

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    // Honeypot check — bots fill hidden fields, humans never see them.
    const honeypot = form.querySelector('input[name="company"]');
    if (honeypot && honeypot.value.trim() !== '') {
      return;
    }

    const name = form.querySelector('#name');
    const email = form.querySelector('#email');
    const message = form.querySelector('#message');

    if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
      showStatus(status, 'error', 'Please fill in your name, email, and message before sending.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Submission failed');
        showStatus(status, 'success', "Thanks — your message is on its way. We'll get back to you soon.");
        form.reset();
      })
      .catch(() => {
        showStatus(
          status,
          'error',
          "Something went wrong sending this. Please email ptsutare@gmail.com directly instead."
        );
      })
      .finally(() => {
        submitBtn.disabled = false;
      });
  });
}

function initVenturePreselect() {
  const select = document.getElementById('venture');
  if (!select) return;

  const params = new URLSearchParams(window.location.search);
  const venture = params.get('venture');
  const isValidOption = Array.from(select.options).some((opt) => opt.value === venture);

  if (venture && isValidOption) {
    select.value = venture;
  }
}

function showStatus(statusEl, type, message) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('success', 'error');
  statusEl.classList.add(type, 'is-visible');
}
