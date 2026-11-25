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
  piede.innerHTML = anni.map(a=>{ const k = corsi.filter(c=>[[c.anno]].concat(c.altri||[]).some(p=>p[0]===a.n)).length; return `<a href="index.html#${a.ancora}" class="${k?'ha':''}">${a.nome}${k?` · ${k}`:''}</a>`; }).join('');
}

// carosello dei tipi di esercizio: un riquadro alla volta, con frecce ed etichette per spostarsi
const binario = $('#car-binario'), comandi = $('#car-comandi');
if(binario && comandi){
  const schede = $$('.tile', binario);
  const NOMI = {'t-flash':'Flashcard','t-quiz':'Quiz','t-esame':'Simulazione','t-casi':'Casi clinici','t-confronti':'Confronti','t-prog':'Progressi'};
  const nome = el => { const k = Object.keys(NOMI).find(c=>el.classList.contains(c)); return k ? NOMI[k] : ($('h3', el)||{}).textContent || ''; };
  const FR = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  comandi.innerHTML = `<button type="button" class="car-freccia" data-dir="-1" aria-label="Esercizio precedente">${FR('M15 5l-7 7 7 7')}</button>
    <div class="car-etichette" role="tablist" aria-label="Scegli il tipo di esercizio">${schede.map((s,i)=>`<button type="button" role="tab" class="car-et" data-i="${i}">${nome(s)}</button>`).join('')}</div>
    <button type="button" class="car-freccia" data-dir="1" aria-label="Esercizio successivo">${FR('M9 5l7 7-7 7')}</button>
    <span class="car-conta" aria-live="polite"></span>`;
  let attiva = 0;
  const vai = i => {
    attiva = Math.max(0, Math.min(schede.length-1, i));
    binario.scrollTo({left: schede[attiva].offsetLeft - binario.offsetLeft, behavior: RIDOTTO ? 'auto' : 'smooth'});
    segna();
  };
  function segna(){
    $$('.car-et', comandi).forEach((b,i)=>{ b.setAttribute('aria-selected', String(i===attiva)); b.tabIndex = i===attiva ? 0 : -1; });
    const et = $$('.car-et', comandi)[attiva];
    if(et && et.scrollIntoView) { const box = et.parentNode; box.scrollTo({left: et.offsetLeft - box.clientWidth/2 + et.clientWidth/2, behavior: RIDOTTO ? 'auto' : 'smooth'}); }
    $('.car-conta', comandi).textContent = `${attiva+1} di ${schede.length}`;
    $$('.car-freccia', comandi).forEach(b=>{ const d=+b.dataset.dir; b.disabled = (d<0 && attiva===0) || (d>0 && attiva===schede.length-1); });
  }
  comandi.addEventListener('click', e=>{
    const f = e.target.closest('.car-freccia'); if(f){ vai(attiva + (+f.dataset.dir)); return; }
    const t = e.target.closest('.car-et'); if(t) vai(+t.dataset.i);
  });
  // con un dito si puo' anche trascinare: l'etichetta segue il riquadro che si ferma al centro
  let fermo = 0;
  binario.addEventListener('scroll', ()=>{
    clearTimeout(fermo);
    fermo = setTimeout(()=>{
      const c = binario.scrollLeft + binario.clientWidth/2;
      let migliore = 0, dist = Infinity;
      schede.forEach((s,i)=>{ const m = s.offsetLeft - binario.offsetLeft + s.clientWidth/2; const d = Math.abs(m-c); if(d<dist){ dist=d; migliore=i; } });
      if(migliore!==attiva){ attiva = migliore; segna(); }
    }, 90);
  }, {passive:true});
  binario.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight'){ e.preventDefault(); vai(attiva+1); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); vai(attiva-1); }
  });
  segna();
}

// con "riduci animazioni" le onde restano ferme
if(RIDOTTO) $$('svg').forEach(s=>{ try{ s.pauseAnimations(); }catch(e){} });
})();
