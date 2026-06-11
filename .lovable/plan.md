
# Plan d'amélioration HireMe — 4 lots prioritaires

Au lieu de tout faire d'un coup (risque de tout casser), je propose 4 lots livrables successivement. Vous validez ce plan, puis j'exécute **lot 1 d'abord**, on teste, on enchaîne.

---

## Lot 1 — Sécurité & Access Control (le plus critique)

**Pourquoi en premier :** une faille RLS = fuite de données = procès. Tout le reste dépend de fondations sûres.

- **Audit RLS complet** sur les 14 tables : vérifier que chaque policy scope bien à `auth.uid()` et qu'aucune donnée d'un user ne fuit vers un autre.
- **Validation Zod stricte** côté serveur sur TOUS les `createServerFn` (max length, regex, types).
- **Protection HIBP** (mots de passe compromis) activée sur l'auth.
- **Rate limiting** maison sur les serverFns sensibles (auto-apply, AI gen, checkout) : table `rate_limits` + middleware → max N req/min par user.
- **RBAC propre** : vérifier que `has_role('admin')` est exigé partout où c'est admin-only (recruteur vs candidat).
- **Sécurisation webhook Stripe** : déjà signé, ajouter validation timing-safe + retry safe.
- **Logs d'audit** : table `audit_log` (qui a fait quoi quand) pour actions sensibles.

## Lot 2 — Paiements & Billing robustness

- **États subscription complets** : gérer `past_due`, `unpaid`, `canceled`, `trialing` proprement dans l'UI.
- **Idempotence** sur checkout (clé idempotency Stripe + dédoublonnage côté DB).
- **Email récap** post-checkout (avec Lovable Email si dispo).
- **Garde Premium** : helper `requirePremium(tier)` réutilisé partout (auto-apply, templates CV avancés, etc.) au lieu de checks ad-hoc.
- **Page facturation** : historique invoices via Stripe API, bouton portail.
- **Failed payment recovery** : webhook `invoice.payment_failed` → flag user + bannière in-app.

## Lot 3 — Observability & Logs

- **Logger structuré** (`src/lib/logger.ts`) : niveau, contexte, user_id ; remplacer `console.log` éparpillés.
- **Error boundary** propre sur chaque route (errorComponent uniforme).
- **Capture erreurs serverFn** : table `error_log` + alertes admin quand >N erreurs/heure.
- **Métriques business** : table `events` (signups, checkouts, applications, matches) pour funnel analytics.
- **Health endpoint** `/api/public/health` (DB + Stripe + AI ping).
- **Sentry-style local** : pas de SaaS vendor lock-in, juste DB + dashboard admin.

## Lot 4 — UX/UI Pro Max + Tests

**UX :**
- **Design system élevé** : refonte tokens `styles.css` (gradients premium, ombres élégantes, animations fluides).
- **Skeleton loaders** partout (au lieu de spinners).
- **Empty states** soignés sur jobs/applications/messages vides.
- **Micro-interactions** : transitions Framer Motion sur cards jobs, success states, toasts riches.
- **Mobile-first audit** : revoir nav, forms, tables sur 375px.
- **Onboarding** : tour produit première connexion (3-4 steps).
- **Dashboard hero** : refonte avec stats live (matches, applications, vues recruteurs).

**Tests :**
- **Vitest config** + tests unitaires sur : auth flow, matching IA scoring, parsing CV, billing helpers, RLS policies.
- **Tests E2E critiques** (Playwright) : signup → onboarding → upload CV → search jobs → apply.

---

## Hors scope (vous avez dit "plus tard")

GDPR/CCPA, multi-région, A/B testing, feature flags, CI/CD avancé, disaster recovery, governance, adtech.
On y reviendra quand les fondations sont solides.

## Repos GitHub tiers

Je ne peux **pas copier** du code de repos open source (licences MIT/Apache exigent attribution, GPL contamine tout le projet). Je peux :
- m'**inspirer des patterns** (shadcn, Vercel design, Linear UX)
- **installer comme dépendances npm** (framer-motion, react-hot-toast, etc.)

Pas de portage de code propriétaire.

---

## Ordre d'exécution proposé

1. **Lot 1 (sécurité)** — 1 itération, ~6-8 fichiers
2. **Lot 2 (billing)** — 1 itération
3. **Lot 3 (observability)** — 1 itération  
4. **Lot 4 (UX + tests)** — 2 itérations

Validez ce plan ou dites-moi ce qu'il faut ajuster, puis je commence par le **Lot 1**.
