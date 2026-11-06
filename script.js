// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Bouton d'achat fixe sur mobile : apparaît après l'accueil,
// disparaît quand un autre bouton "Rejoindre" est déjà à l'écran.
const mobileCta = document.querySelector('.mobile-cta');
const hero = document.querySelector('.hero');
const inlineCtas = document.querySelectorAll('.price .btn, .final .btn');
if (mobileCta && hero && 'IntersectionObserver' in window) {
  let pastHero = false;
  const visible = new Set();
  const update = () => mobileCta.classList.toggle('is-visible', pastHero && visible.size === 0);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); }).observe(hero);
  const ctaObserver = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
    update();
  });
  inlineCtas.forEach(el => ctaObserver.observe(el));
}

// Année du copyright
document.getElementById('year').textContent = new Date().getFullYear();
