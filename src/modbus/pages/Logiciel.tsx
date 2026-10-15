import ServeurModbus from '../components/ServeurModbus'

export default function Logiciel() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-lg bg-[#008080] p-2 sm:p-6">
        <ServeurModbus />
      </div>
      <p className="mt-3 text-xs text-muted">Fenêtres reconstituées d’après le PRD ; aucun réseau connecté à cette étape.</p>
    </main>
  )
}
