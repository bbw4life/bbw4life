(function () {
  'use strict';

  // ── Pages jamais bloquées par le mode maintenance ─────────────────
  // La page de maintenance elle-même (sinon boucle de redirection), et
  // les dashboards internes admin (eprolo/cj/analytics) qu'on doit
  // pouvoir garder ouverts pour gérer le site pendant la maintenance.
  var EXEMPT_PATHS = [
    '/coming-soon.html',
    '/eprolo-viewer.html',
    '/cj-viewer.html',
    '/bbw4life-analytiques.html'
  ];

  var path = window.location.pathname;
  if (EXEMPT_PATHS.indexOf(path) !== -1) return;

  // ── Session admin ──────────────────────────────────────────────────
  // Même clé que le gate password d'eprolo-viewer.html/cj-viewer.html —
  // un admin déjà authentifié sur l'un de ces outils (ou sur la clé de
  // coming-soon.html) navigue librement partout, mode maintenance ou
  // non, sans avoir à re-saisir le mot de passe page par page.
  var SESSION_KEY = 'eprolo_auth_ok';
  var isAdmin = false;
  try { isAdmin = sessionStorage.getItem(SESSION_KEY) === 'yes'; } catch (e) {}
  if (isAdmin) return;

  // ── Fast-path synchrone via cache local ─────────────────────────────
  // Redirige immédiatement si la dernière confirmation réseau connue
  // disait "maintenance activée" — évite un flash de la vraie page le
  // temps que le fetch ci-dessous réponde. Si rien en cache (première
  // visite) ou "no", on laisse la page s'afficher normalement et on ne
  // redirige qu'après confirmation réseau.
  var CACHE_KEY = 'bbw_maintenance_mode';
  var cached = null;
  try { cached = localStorage.getItem(CACHE_KEY); } catch (e) {}
  if (cached === 'yes') {
    window.location.replace('/coming-soon.html');
    return; // le reste du <head>/<body> ne doit pas s'exécuter après ça
  }

  // ── Confirmation réseau (source de vérité) ──────────────────────────
  fetch('/products.data.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var arr      = Array.isArray(data) ? data : [];
      var settings = arr.find(function (p) { return p.type === 'settings'; }) || {};
      var enabled  = (settings.maintenance_mode || 'no').trim().toLowerCase() === 'yes';

      try { localStorage.setItem(CACHE_KEY, enabled ? 'yes' : 'no'); } catch (e) {}

      // Re-vérifie la session admin : le fetch est asynchrone, un clic
      // sur la clé + déverrouillage a pu se produire entre-temps.
      var stillAdmin = false;
      try { stillAdmin = sessionStorage.getItem(SESSION_KEY) === 'yes'; } catch (e) {}

      if (enabled && !stillAdmin) {
        window.location.replace('/coming-soon.html');
      }
    })
    .catch(function () {});
})();
