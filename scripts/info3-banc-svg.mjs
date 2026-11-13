// Génère src/info3/board/curiosity-hpc.svg (fond) et click-*.svg (cartes) depuis docs/info3/curiosity_hpc_banc_info3.svg.
// Usage : node scripts/info3-banc-svg.mjs
import { readFileSync, writeFileSync } from 'fs'
let s = readFileSync('docs/info3/curiosity_hpc_banc_info3.svg', 'utf8')
const take = (from, toIncl) => {
  const a = s.indexOf(from); if (a < 0) throw new Error('absent : ' + from)
  const b = toIncl === null ? s.lastIndexOf('</g>') : s.indexOf(toIncl, a) + toIncl.length
  if (b < a + from.length) throw new Error('absent : ' + toIncl)
  const frag = s.slice(a, b)
  s = s.slice(0, a) + s.slice(b)
  return frag
}
s = s.replace(/<metadata>[\s\S]*?<\/metadata>/, '').replace(/<title[^>]*>[\s\S]*?<\/title>/, '').replace(/<desc[^>]*>[\s\S]*?<\/desc>/, '')
s = s.replace(/ style="[^"]*"/g, '')
for (const id of ['tp', 'ho', 'hp', 'mx', 'pd']) s = s.replaceAll(`id="${id}"`, `id="i3b-${id}"`).replaceAll(`href="#${id}"`, `href="#i3b-${id}"`).replaceAll(`url(#${id})`, `url(#i3b-${id})`)
// Câbles USB : dessinés selon l'état du banc
for (const d of ['M380 740', 'M380 790', 'M1100 515']) take(`<path d="${d}`, '>')
// Parties mobiles redessinées : aiguille du potentiomètre, chapeau du joystick
take('<path d="M700 1040 L726 1015"', '>')
take('<circle cx="900" cy="705" r="62"', '>')
// Cartes Click (enfichables) : 8x8 R click, puis ROTARY (dernier élément) sans son anneau ni sa molette
let mx = take('<rect x="1158" y="395"', '8x8 R click</text>')
mx = mx.replace(/<rect x="1168" y="403"[^>]*>/, '') // matrice : LED dessinées une à une
let rot = take('<path d="M1165 815', null)
rot = rot.slice(0, rot.indexOf('<rect x="1267" y="1075"')).replace('ROTARY R click', 'ROTARY O click') // nom du modèle (reference.ts)
// Étiquette sous le potentiomètre : broche du modèle (RA0, annexe 1)
s = s.replace(/(<text x="713" y="1092"[^>]*>)RB4</, '$1RA0<')
s = s.replace(/<g transform="[^"]*"/, '<g').replace(/<svg [^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="170 335 1450 1000">')
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1150 390 240 890"><g font-size="20" fill="#F4EDE4" text-anchor="middle">${body}</g></svg>\n`
writeFileSync('src/info3/board/curiosity-hpc.svg', s + '\n')
writeFileSync('src/info3/board/click-8x8.svg', svg(mx))
writeFileSync('src/info3/board/click-rotary.svg', svg(rot))
console.log(s.length, mx.length, rot.length)
