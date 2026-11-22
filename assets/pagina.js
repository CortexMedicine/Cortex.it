/* Cortex: script delle pagine secondarie (per ora "Come funziona").
   Comparsa allo scorrimento, barra di avanzamento, luce che segue il mouse,
   alone sui riquadri e indice degli anni nel piede. La pagina principale usa hub.js. */
(function(){
'use strict';
const $ = (s,el)=> (el||document).querySelector(s);
const $$ = (s,el)=> Array.from((el||document).querySelectorAll(s));
const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PUNTATORE = window.matchMedia('(pointer:fine)').matches;

// comparsa morbida allo scorrimento
const osserva = ('IntersectionObserver' in window) ? new IntersectionObserver(voci=>{
  voci.forEach(v=>{ if(v.isIntersecting){ v.target.classList.add('visto'); osserva.unobserve(v.target); } });
}, {rootMargin:'0px 0px -6% 0px', threshold:0.08}) : null;
$$('.rivela').forEach(el=>{ if(osserva) osserva.observe(el); else el.classList.add('visto'); });

// barra in cima e barra di navigazione che si fa piu' scura scorrendo
const nav = $('#nav'), barra = $('#barra-scroll');
function suScorrimento(){
  if(nav) nav.classList.toggle('scorre', window.scrollY > 10);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if(barra) barra.style.transform = `scaleX(${max>0 ? Math.min(1, window.scrollY/max).toFixed(4) : 0})`;
}
window.addEventListener('scroll', suScorrimento, {passive:true});
suScorrimento();

// luce che segue il puntatore e alone sui riquadri
if(!RIDOTTO && PUNTATORE){
  const luce = $('.luce');
  if(luce){
    let rq = 0, lx = 0, ly = 0;
    window.addEventListener('pointermove', e=>{
      lx = e.clientX; ly = e.clientY;
      if(!rq) rq = requestAnimationFrame(()=>{ rq = 0; luce.style.setProperty('--lx', lx+'px'); luce.style.setProperty('--ly', ly+'px'); luce.classList.add('accesa'); });
    }, {passive:true});
    document.documentElement.addEventListener('pointerleave', ()=>luce.classList.remove('accesa'));
  }
}
document.addEventListener('pointermove', e=>{
  const el = e.target.closest && e.target.closest('.tile, .passo'); if(!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (e.clientX-r.left)+'px');
  el.style.setProperty('--my', (e.clientY-r.top)+'px');
}, {passive:true});

// indice degli anni nel piede: porta all'anno nella pagina principale
const piede = $('#piede-anni');
if(piede){
  const corsi = ((window.CATALOGO||{}).corsi||[]).filter(c=>c.href);
  const ROMANI = ['I','II','III','IV','V','VI'];
  const anni = [{n:0, nome:'Semestre Filtro', ancora:'semestre-filtro'}].concat(ROMANI.map((r,i)=>({n:i+1, nome:r+' anno', ancora:'anno-'+(i+1)})));
  piede.innerHTML = anni.map(a=>{ const k = corsi.filter(c=>c.anno===a.n).length; return `<a href="index.html#${a.ancora}" class="${k?'ha':''}">${a.nome}${k?` · ${k}`:''}</a>`; }).join('');
}

// con "riduci animazioni" le onde restano ferme
if(RIDOTTO) $$('svg').forEach(s=>{ try{ s.pauseAnimations(); }catch(e){} });
})();
