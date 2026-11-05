// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Bouton "Choisir" d'un tarif : pré-sélectionne la formule dans le formulaire
document.querySelectorAll('[data-plan]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('formule').value = btn.dataset.plan;
  });
});

// Formulaire : tant qu'aucun service d'envoi n'est branché (action="#"),
// on affiche simplement un message de confirmation.
const form = document.getElementById('form');
form.addEventListener('submit', (e) => {
  if (form.getAttribute('action') === '#') {
    e.preventDefault();
    document.getElementById('form-status').textContent =
      'Merci ! Votre demande a bien été enregistrée. (Démo : brancher un service d\'envoi.)';
    form.reset();
  }
});

// Année du copyright
document.getElementById('year').textContent = new Date().getFullYear();
