import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "Mentions légales & confidentialité — HireMe" },
      { name: "description", content: "Mentions légales, politique de confidentialité et conditions d'utilisation de HireMe." },
      { property: "og:title", content: "Mentions légales — HireMe" },
      { property: "og:description", content: "Vie privée, données et conditions d'utilisation de HireMe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LegalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 space-y-14">
        <header>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">Mentions légales & confidentialité</h1>
          <p className="text-sm text-muted-foreground mt-2">Dernière mise à jour : 28 juillet 2026</p>
        </header>

        <section id="privacy" className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Politique de confidentialité (RGPD)</h2>
          <p className="text-sm text-muted-foreground">
            HireMe collecte uniquement les données que vous fournissez volontairement : email, mot de passe (haché),
            informations de profil, CV, candidatures et messages. Ces données servent exclusivement à faire
            fonctionner la plateforme (matching d'offres, génération de CV, communication candidat/recruteur).
          </p>
          <h3 className="font-semibold mt-4">Vos droits</h3>
          <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
            <li>Accès et rectification : depuis votre page <em>Profil</em>.</li>
            <li>Portabilité : export à la demande via contact@hireme.app.</li>
            <li>Suppression : bouton « Supprimer mon compte » dans le Tableau de bord — irréversible.</li>
            <li>Opposition : désactivez la visibilité recruteur depuis le Tableau de bord.</li>
          </ul>
          <h3 className="font-semibold mt-4">Sous-traitants</h3>
          <p className="text-sm text-muted-foreground">
            Hébergement et base de données : Lovable Cloud (Supabase). Paiements : Stripe (Irlande). IA :
            Lovable AI Gateway. Recherche d'offres : Firecrawl et APIs publiques (Remotive, RemoteOK, Arbeitnow,
            The Muse, Jobicy).
          </p>
        </section>

        <section id="terms" className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Conditions d'utilisation</h2>
          <p className="text-sm text-muted-foreground">
            HireMe est un service d'aide à la recherche d'emploi. Aucune garantie de résultat n'est offerte.
            Vous vous engagez à ne pas utiliser la plateforme pour publier de contenu illégal, harcelant ou
            trompeur. Les offres affichées proviennent de sources tierces et peuvent être expirées ou modifiées ;
            HireMe n'est pas responsable du contenu des annonces ni des processus de recrutement externes.
          </p>
          <p className="text-sm text-muted-foreground">
            L'offre gratuite permet un usage complet des fonctions de base (analyse CV, recherche d'offres,
            candidatures manuelles). Les offres Pro et Business débloquent l'auto-candidature et les outils
            avancés pour recruteurs, facturées via Stripe. Résiliation à tout moment depuis votre espace
            facturation.
          </p>
        </section>

        <section id="contact" className="space-y-3">
          <h2 className="font-display text-2xl font-bold">Contact</h2>
          <p className="text-sm text-muted-foreground">
            Éditeur : HireMe. Pour toute question, demande RGPD ou signalement :
            <a className="underline ml-1" href="mailto:contact@hireme.app">contact@hireme.app</a>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}