import { Link } from 'react-router'
import Etabli from '../ui/Etabli'
import { useBanc } from '../ui/useBanc'

/** Banc libre : tous les instruments et le câblage, sans questions */
export default function BancLibre() {
  const { etat, agir } = useBanc()
  return (
    <div className="min-h-screen bg-au3-bg text-au3-ink">
      <main className="mx-auto max-w-[1440px] space-y-3 p-3 sm:p-4">
        <header>
          <p className="text-xs text-au3-muted">
            <Link to="/au3" className="underline">
              AU3
            </Link>{' '}
            › Banc libre
          </p>
          <h1 className="text-lg font-semibold">Banc libre</h1>
          <p className="text-xs text-au3-muted">Cliquez une borne puis une autre pour poser un câble ; cliquez un câble pour le recolorer ou le débrancher. « Faire vérifier » avant la mise sous tension.</p>
        </header>
        <Etabli etat={etat} agir={agir} />
      </main>
    </div>
  )
}
