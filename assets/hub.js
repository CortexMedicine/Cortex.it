/* Cortex: pagina generale con tutti i corsi.
   Percorso degli anni (un assone su cui corre il segnale), corsi per semestre, ricerca, "Riprendi",
   cellule a fluorescenza nell'apertura che reagiscono al mouse.
   I corsi arrivano da catalogo.js, generato da costruisci.py. */
(function(){
'use strict';

const CAT = window.CATALOGO || {corsi:[]};
const CORSI = (CAT.corsi || []).slice().sort((a,b)=> a.anno-b.anno || a.semestre-b.semestre || a.titolo.localeCompare(b.titolo,'it'));
const ROMANI = ['I','II','III','IV','V','VI'];
const GIORNO = 86400000;
const NS = 'http://www.w3.org/2000/svg';
const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PUNTATORE = window.matchMedia('(pointer:fine)').matches;
const FRECCIA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SCINTILLA = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z" fill="currentColor"/></svg>';

const $ = (s,el)=> (el||document).querySelector(s);
const $$ = (s,el)=> Array.from((el||document).querySelectorAll(s));
const fmt = n => String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const plur = (n,s,p)=> n===1 ? s : p;
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const senzaAccenti = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const morbida = p => p<.5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2;
function leggi(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function scrivi(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

const elNav = $('#nav'), elSentiero = $('#sentiero'), elPannello = $('#pannello'), elRiprendi = $('#riprendi');
const elCerca = $('#cerca'), elSug = $('#suggerimenti');

/* ---------- progressi salvati dai corsi (stesso browser, stesso sito) ----------
   Ogni formato di corso salva in modo diverso; qui diventano tutti:
   visti (esercizi o flashcard affrontati), consolidati, totale e ultimo studio. */
const LETTORI = {
  // formato "ripasso": flashcard a scatole, piu' quiz, vero/falso e casi
  'ripasso-v1'(s, n){
    const valori = k => (s[k] && typeof s[k]==='object') ? Object.values(s[k]).filter(Boolean) : [];
    const carte = valori('cards');
    const risposte = valori('quiz').concat(valori('tf'), valori('cases'));
    const storia = Array.isArray(s.history) ? s.history.filter(Boolean) : [];
    if(!carte.length && !risposte.length && !storia.length) return null;
    let ultimo = 0;
    storia.forEach(h=>{ if(h.t>ultimo) ultimo=h.t; });
    carte.forEach(x=>{ if(x.last>ultimo) ultimo=x.last; });
    risposte.forEach(x=>{ if(x.t>ultimo) ultimo=x.t; });
    return {visti: carte.length, consolidati: carte.filter(x=>(x.box||0)>=3).length, tot: n.flashcard||0, ultimo,
            cosa: 'flashcard', fatti: 'viste', cons: ['imparata','imparate']};
  },
  // formato "allenamento": quiz (m), vero/falso (v), flashcard (f) e domande aperte (o), piu' casi e confronti
  'allenamento-v1'(s, n){
    const prog = (s.prog && typeof s.prog==='object') ? s.prog : {};
    let visti = 0, consolidati = 0, ultimo = 0;
    for(const k in prog){
      const r = prog[k]; if(!r || typeof r!=='object') continue;
      if(r.t>ultimo) ultimo = r.t;
      const tipo = k.charAt(0);
      if(k.charAt(1)!=='-' || 'mvfo'.indexOf(tipo)<0) continue;   // casi e confronti hanno chiavi diverse
      visti++;
      if((tipo==='m' || tipo==='v') && String(r.r||'').slice(-2)==='11') consolidati++;
      else if(tipo==='f' && (r.b||0)>=3) consolidati++;
      else if(tipo==='o' && (r.s||0)>=0.75) consolidati++;
    }
    const esami = (s.meta && Array.isArray(s.meta.exams)) ? s.meta.exams : [];
    esami.forEach(e=>{ if(e && e.id>ultimo) ultimo = e.id; });
    if(!visti && !esami.length && !ultimo) return null;
    return {visti, consolidati, tot: n.esercizi||0, ultimo, cosa: 'esercizi', fatti: 'fatti', cons: ['consolidato','consolidati']};
  }
};
function progresso(c){
  const p = c.progressi; if(!p || !p.chiave || !c.href) return null;
  const lettore = LETTORI[p.formato]; if(!lettore) return null;
  const raw = leggi(p.chiave); if(!raw) return null;
  let s; try{ s = JSON.parse(raw); }catch(e){ return null; }
  if(!s || typeof s!=='object') return null;
  const r = lettore(s, c.numeri||{}); if(!r) return null;
  const perc = x => !r.tot || !x ? 0 : Math.max(1, Math.round(100*x/r.tot));
  r.pctVisti = perc(r.visti); r.pctCons = perc(r.consolidati);
  return r;
}
function quando(t){
  if(!t) return '';
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const giorni = Math.round((oggi.getTime() - new Date(t).setHours(0,0,0,0)) / GIORNO);
  if(giorni<=0) return 'oggi';
  if(giorni===1) return 'ieri';
  if(giorni<7) return giorni+' giorni fa';
  return 'il '+new Date(t).toLocaleDateString('it-IT',{day:'numeric',month:'long'});
}
function recente(){
  let meglio = null;
  CORSI.forEach(c=>{ const p=progresso(c); if(p && p.ultimo && (!meglio || p.ultimo>meglio.p.ultimo)) meglio={c,p}; });
  return meglio;
}
// anello di avanzamento: chiaro = visti, pieno = consolidati
function anello(p, dim){
  const r = 15, giro = 2*Math.PI*r;
  const arco = (pct, cls)=> pct ? `<circle class="${cls}" cx="18" cy="18" r="${r}" stroke-dasharray="${(giro*pct/100).toFixed(2)} ${giro.toFixed(2)}"/>` : '';
  return `<svg class="anello" viewBox="0 0 36 36" width="${dim}" height="${dim}" aria-hidden="true"><circle class="a-fondo" cx="18" cy="18" r="${r}"/>${arco(p.pctVisti,'a-viste')}${arco(p.pctCons,'a-imparate')}</svg>`;
}

/* ---------- schede dei corsi ---------- */
// un corso puo' stare in piu' anni/semestri (per esempio Anatomia nel I e nel II anno): "altri" in catalogo.js
const posti = c => [[c.anno, c.semestre]].concat(c.altri || []);
const sta = (c, anno, sem)=> posti(c).some(([a,s])=> a===anno && (!sem || s===sem));
const dovePosto = ([a,s])=> a===0 ? 'Semestre Filtro' : `${ROMANI[a-1]} anno · ${s}° semestre`;
const dove = c => posti(c).map(dovePosto).join(' e ');
const pubblicati = (anno, sem)=> CORSI.filter(c=> c.href && sta(c, anno, sem));
const N_PUBBLICATI = CORSI.filter(c=>c.href).length;
const ULTIMO = CORSI.filter(c=>c.href).sort((a,b)=>(b.ordine||0)-(a.ordine||0))[0] || null;   // l'ultimo corso aggiunto
function chips(c){
  const n = c.numeri; if(!n) return '';
  const out = [];
  if(n.capitoli) out.push(fmt(n.capitoli)+' '+plur(n.capitoli,'capitolo','capitoli'));
  const dom = (n.quiz||0)+(n.verofalso||0);
  if(dom) out.push(fmt(dom)+' '+plur(dom,'domanda','domande'));
  if(n.flashcard) out.push(fmt(n.flashcard)+' flashcard');
  if(n.aperte) out.push(fmt(n.aperte)+' '+plur(n.aperte,'domanda aperta','domande aperte'));
  if(n.casi) out.push(fmt(n.casi)+' '+plur(n.casi,'caso clinico','casi clinici'));
  if(n.confronti) out.push(fmt(n.confronti)+' '+plur(n.confronti,'confronto','confronti'));
  return out.length ? `<span class="chips">${out.map(x=>`<span>${x}</span>`).join('')}</span>` : '';
}
function stato(c){
  const p = progresso(c);
  if(!p) return `<span class="stato nuovo">${SCINTILLA}Da iniziare</span>`;
  const testo = p.visti && p.tot ? `<b>${fmt(p.visti)}</b> di ${fmt(p.tot)} ${p.cosa} ${p.fatti}` : 'Studio iniziato';
  return `<span class="stato">${anello(p,32)}<span>${testo}${p.ultimo?`<br><small>ultimo studio ${quando(p.ultimo)}</small>`:''}</span></span>`;
}
function scheda(c, opz){
  opz = opz || {};
  const stile = `--c:${esc(c.colore||'#5B8CFF')}`;
  const nuovo = (c===ULTIMO && N_PUBBLICATI>1) ? '<span class="tag-nuovo">Nuovo</span>' : '';
  // anteprima degli argomenti (le "parti" del corso), per capire a colpo d'occhio cosa contiene
  const arg = c.argomenti || [];
  const argomenti = arg.length ? `<span class="corso-argomenti">${arg.slice(0,4).map(esc).join(' · ')}${arg.length>4 ? ` · <b>+${arg.length-4}</b>` : ''}</span>` : '';
  const testa = `<span class="corso-testa"><span class="orb" aria-hidden="true">${esc(c.sigla)}</span><span class="corso-intro">${nuovo}${opz.dove?`<span class="corso-dove">${dove(c)}</span>`:''}<span class="corso-titolo">${esc(c.titolo)}</span>${c.descrizione?`<span class="corso-desc">${esc(c.descrizione)}</span>`:''}${argomenti}</span></span>`;
  if(!c.href) return `<div class="corso arrivo" style="${stile}">${testa}<span class="corso-piede"><span class="stato">${SCINTILLA}In arrivo</span></span></div>`;
  return `<a class="corso" href="${esc(c.href)}" style="${stile}">${testa}${chips(c)}<span class="corso-piede">${stato(c)}<span class="apri">Apri il corso ${FRECCIA}</span></span></a>`;
}

/* ---------- il percorso degli anni: un assone mielinizzato ----------
   Le sette tappe (il Semestre Filtro, numero 0, e i sei anni) sono i nodi; scegliendo
   un anno un impulso corre lungo la fibra e "salta" da un nodo all'altro,
   come nella conduzione saltatoria. La posizione nell'elenco ANNI coincide col numero. */
const ANNI = [{sigla:'SF', nome:'Semestre Filtro', titolo:'Semestre <em>Filtro</em>'}]
  .concat(ROMANI.map(r=>({sigla:r, nome:r+' anno', titolo:`${r} <em>anno</em>`})));
const ULTIMO_ANNO = ANNI.length-1;
// semestri di ogni anno: il Semestre Filtro e' unico, il I anno ha solo il 2° semestre
const semestriDi = n => n===0 ? [1] : n===1 ? [2] : [1,2];
const valido = n => Number.isInteger(n) && n>=0 && n<=ULTIMO_ANNO;
// semestri da scegliere: negli anni con un solo semestre (Filtro e I anno) i corsi si vedono subito
const daScegliere = n => semestriDi(n).length > 1;
// ancora nell'indirizzo: #semestre-filtro, #anno-1 ... #anno-6, e con il semestre #anno-4-s2
const ancora = (n, s) => n===0 ? 'semestre-filtro' : 'anno-'+n+(s && daScegliere(n) ? '-s'+s : '');
// anno (e semestre) scritti nell'indirizzo, oppure null
function daIndirizzo(){
  if(location.hash==='#semestre-filtro') return {anno:0, sem:null};
  const m=/^#anno-([1-6])(?:-s([12]))?$/.exec(location.hash);
  if(!m) return null;
  const n = +m[1], s = m[2] ? +m[2] : null;
  return {anno:n, sem: s && semestriDi(n).includes(s) && daScegliere(n) ? s : null};
}
// all'apertura nessun anno e' scelto: lo sceglie l'utente. Solo un indirizzo con l'anno
// (per esempio "Tutti i corsi" da dentro un corso, o l'indice nel piede) lo apre gia' scelto.
const inizio = daIndirizzo();
let anno = inizio ? inizio.anno : null;
let semestre = inizio ? inizio.sem : null;
let geo = null, posizione = 0, animazione = 0;
let sentieroAcceso = RIDOTTO || !('IntersectionObserver' in window);

function costruisciSentiero(){
  elSentiero.innerHTML = `<svg class="sentiero-svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="s-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
          <stop offset="0" stop-color="#3DF5A6"/><stop offset=".5" stop-color="#5B8CFF"/><stop offset="1" stop-color="#FF4D9D"/>
        </linearGradient>
        <radialGradient id="s-impulso"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#D6E3FF" stop-opacity=".95"/><stop offset="1" stop-color="#5B8CFF" stop-opacity="0"/></radialGradient>
        <filter id="s-sfoca" x="-10%" y="-120%" width="120%" height="340%"><feGaussianBlur stdDeviation="6"/></filter>
        <mask id="s-maschera" maskUnits="userSpaceOnUse" x="-50" y="-50" width="5000" height="1000"><path class="s-rivela"/></mask>
      </defs>
      <path class="s-assone"/><path class="s-mielina"/>
      <g mask="url(#s-maschera)"><path class="s-alone" filter="url(#s-sfoca)"/><path class="s-mielina-accesa"/><path class="s-assone-acceso"/></g>
      <path class="s-scia-alone" filter="url(#s-sfoca)"/><path class="s-scia"/>
      <circle class="s-testa" r="15" cx="-50" cy="-50"/>
    </svg>
    <div class="tappe" id="anni" role="tablist" aria-label="Anno di corso">${ANNI.map((a,n)=>{
      const k = pubblicati(n).length;
      const etichetta = k ? `${k} ${plur(k,'corso','corsi')}` : 'in arrivo';
      return `<div class="tappa${k?' ha-corsi':''}${n%2?' alta':''}${n===0?' filtro':''}" role="presentation">
        <button type="button" class="nodo" role="tab" id="tab-${n}" data-anno="${n}" aria-controls="pannello" aria-label="${a.nome}, ${k ? k+' '+plur(k,'corso','corsi') : 'nessun corso ancora'}">${a.sigla}</button>
        <span class="tappa-et" aria-hidden="true">${etichetta}</span></div>`;
    }).join('')}</div>`;
  aggiornaTappe();
}
function calcolaGeometria(){
  const w = elSentiero.clientWidth, h = elSentiero.clientHeight;
  if(!w || !h) return null;
  const stretto = w < 560;
  const margine = stretto ? Math.max(26, w*0.075) : Math.min(96, w*0.085);
  const passo = (w - 2*margine)/ULTIMO_ANNO;
  const su = h*(stretto ? 0.33 : 0.35), giu = h*(stretto ? 0.69 : 0.67);
  const punti = ANNI.map((_,i)=>({x: margine + i*passo, y: i%2 ? su : giu}));
  const tutti = [{x:-6, y:h*0.5}].concat(punti, [{x:w+6, y:h*0.5}]);
  const tratto = (a,b)=>{ const dx=(b.x-a.x)*0.5; return ` C ${a.x+dx} ${a.y} ${b.x-dx} ${b.y} ${b.x} ${b.y}`; };
  const d = fino => { let s=`M ${tutti[0].x} ${tutti[0].y}`; for(let i=1;i<=fino;i++) s+=tratto(tutti[i-1],tutti[i]); return s; };
  const svg = $('.sentiero-svg', elSentiero);
  const misura = document.createElementNS(NS,'path'); svg.appendChild(misura);
  const lunghezze = punti.map((_,i)=>{ misura.setAttribute('d', d(i+1)); return misura.getTotalLength(); });
  const dTutto = d(tutti.length-1);
  misura.setAttribute('d', dTutto); const totale = misura.getTotalLength();
  misura.remove();
  return {w, h, punti, dTutto, lunghezze, totale};
}
function disegnaSentiero(){
  const g = calcolaGeometria(); if(!g) return;
  geo = g;
  const svg = $('.sentiero-svg', elSentiero);
  svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
  $('#s-grad', elSentiero).setAttribute('x2', g.w);
  $$('path', svg).forEach(p=>p.setAttribute('d', g.dTutto));
  $$('.tappa', elSentiero).forEach((t,i)=>{ t.style.left = g.punti[i].x+'px'; t.style.top = g.punti[i].y+'px'; });
  // dopo un ridimensionamento il segnale resta fermo sull'anno scelto
  cancelAnimationFrame(animazione); animazione = 0;
  posizione = (sentieroAcceso && anno!==null) ? g.lunghezze[anno] : 0;
  mostraTraccia(posizione, false);
}
function mostraTraccia(cur, inMoto){
  if(!geo) return;
  const svg = $('.sentiero-svg', elSentiero);
  $('.s-rivela', svg).style.strokeDasharray = `${cur.toFixed(1)} ${(geo.totale+100).toFixed(1)}`;
  if(inMoto){
    const scia = Math.min(80, cur);
    $$('.s-scia, .s-scia-alone', svg).forEach(p=>{
      p.style.strokeDasharray = `${scia.toFixed(1)} ${(geo.totale+400).toFixed(1)}`;
      p.style.strokeDashoffset = (-Math.max(0, cur-scia)).toFixed(1);
    });
    const pt = $('.s-assone', svg).getPointAtLength(Math.max(0, cur));
    const testa = $('.s-testa', svg); testa.setAttribute('cx', pt.x.toFixed(1)); testa.setAttribute('cy', pt.y.toFixed(1));
  }
  elSentiero.classList.toggle('conduce', !!inMoto);
}
function lampeggia(i){
  const t = $$('.tappa', elSentiero)[i]; if(!t) return;
  t.classList.remove('scatta'); void t.offsetWidth; t.classList.add('scatta');
  setTimeout(()=>t.classList.remove('scatta'), 600);
}
// l'impulso parte da dove si trova e salta di nodo in nodo fino all'anno scelto
function conduci(versoAnno){
  cancelAnimationFrame(animazione); animazione = 0;
  if(!geo) return;
  const fine = geo.lunghezze[versoAnno];
  if(RIDOTTO){ posizione = fine; mostraTraccia(fine, false); return; }
  const avanti = fine > posizione;
  const fermate = geo.lunghezze.filter(L => avanti ? (L > posizione+1 && L <= fine+0.5) : (L < posizione-1 && L >= fine-0.5));
  if(!avanti) fermate.reverse();
  if(!fermate.length){ posizione = fine; mostraTraccia(fine, false); return; }
  const DURATA = 230, PAUSA = 55;
  let da = posizione, k = 0, t0 = null;
  const passo = t=>{
    if(t0===null) t0 = t;
    const meta = fermate[k];
    const p = Math.max(0, Math.min(1, (t-t0)/DURATA));
    const cur = da + (meta-da)*morbida(p);
    posizione = cur; mostraTraccia(cur, true);
    if(p>=1){
      lampeggia(geo.lunghezze.indexOf(meta));
      k++; da = meta; t0 = t + PAUSA;
      if(k>=fermate.length){ posizione = meta; mostraTraccia(meta, false); animazione = 0; return; }
    }
    animazione = requestAnimationFrame(passo);
  };
  animazione = requestAnimationFrame(passo);
}
function aggiornaTappe(){
  const fuoco = anno===null ? 0 : anno;   // senza anno scelto la tastiera entra dalla prima tappa
  elSentiero.classList.toggle('nessuno', anno===null);
  $$('.tappa', elSentiero).forEach((t,i)=>{
    const sel = i===anno, b = $('.nodo', t);
    t.classList.toggle('scelta', sel);
    b.setAttribute('aria-selected', String(sel));
    b.tabIndex = i===fuoco ? 0 : -1;
  });
}

/* ---------- semestri dell'anno scelto ---------- */
function semestreHtml(s){
  const lista = CORSI.filter(c=>sta(c, anno, s));
  const k = lista.filter(c=>c.href).length;
  const corpo = lista.length ? lista.map(c=>scheda(c)).join('')
    : `<div class="vuoto"><span class="vuoto-blob" aria-hidden="true">${SCINTILLA}</span><p class="vuoto-t">Ancora nessun corso</p><p class="vuoto-s">I corsi di questo semestre arriveranno presto.</p></div>`;
  // il Semestre Filtro e' uno solo: niente "1°", al suo posto la sigla
  const filtro = anno===0;
  const testa = filtro ? '<h4><span class="sem-n">SF</span>le materie del filtro</h4>' : `<h4><span class="sem-n">${s}°</span>semestre</h4>`;
  return `<section class="semestre${lista.length?'':' vuota'}${filtro?' filtro':''}" data-n="${s}" aria-label="${filtro?'Semestre Filtro':s+'° semestre'}"><div class="sem-testa">${testa}${k?`<span class="pill">${k} ${plur(k,'corso','corsi')}</span>`:''}</div><div class="sem-lista">${corpo}</div></section>`;
}
function semScelta(s){
  const lista = CORSI.filter(c=>c.href && sta(c, anno, s));
  const k = lista.length, sel = s===semestre;
  const orb = lista.slice(0,5).map(c=>`<span class="mini-orb" style="--c:${esc(c.colore||'#5B8CFF')}">${esc(c.sigla)}</span>`).join('');
  return `<button type="button" class="sem-scelta${sel?' scelto':''}${k?'':' vuoto-sem'}" data-sem="${s}" aria-pressed="${sel}">
    <span class="ss-n">${s}°</span><span class="ss-t">semestre</span>
    <span class="ss-info">${k ? `${k} ${plur(k,'corso','corsi')}` : 'in arrivo'}</span>
    ${orb ? `<span class="ss-orb" aria-hidden="true">${orb}</span>` : ''}
  </button>`;
}
function disegnaPannello(anima){
  // nessun anno scelto: solo l'invito a toccarne uno
  if(anno===null){
    elPannello.removeAttribute('aria-labelledby');
    elPannello.innerHTML = `<div class="pannello-invito${anima?' entra-t':''}"><span class="invito-freccia" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p>Tocca il tuo anno sul percorso qui sopra</p></div>`;
    return;
  }
  const k = pubblicati(anno).length;
  elPannello.setAttribute('aria-labelledby', 'tab-'+anno);
  const testa = sotto => `<div class="pannello-testa${anima?' entra-t':''}"><h3>${ANNI[anno].titolo}</h3><p>${sotto}</p></div>`;
  // Semestre Filtro e I anno: un solo semestre, i corsi compaiono subito
  if(!daScegliere(anno)){
    elPannello.innerHTML = testa(k ? `${k} ${plur(k,'corso disponibile','corsi disponibili')}` : (anno===0 ? 'Le materie del semestre filtro arriveranno presto' : 'I corsi di quest\'anno arriveranno presto'))
      + `<div class="semestri unico${anima?' entra':''}">${semestriDi(anno).map(semestreHtml).join('')}</div>`;
    return;
  }
  // gli altri anni: prima il semestre, poi i corsi di quel semestre
  elPannello.innerHTML = testa(semestre ? `${semestre}° semestre` : 'Scegli il semestre')
    + `<div class="sem-scelte${semestre?' compatte':''}${anima?' entra':''}" role="group" aria-label="Semestre">${semestriDi(anno).map(semScelta).join('')}</div>`
    + (semestre ? `<div class="semestri unico entra" id="corsi-semestre">${semestreHtml(semestre)}</div>` : '');
}
// porta i corsi sullo schermo se sono rimasti sotto (succede sul telefono)
function mostraSeSotto(el){
  if(!el) return;
  const r = el.getBoundingClientRect();
  if(r.top > window.innerHeight - 140){
    const stretto = window.innerWidth < 820;
    window.scrollTo({top: window.scrollY + r.top - (stretto ? 84 : window.innerHeight*0.4), behavior: RIDOTTO ? 'auto' : 'smooth'});
  }
}
function scriviIndirizzo(){
  const h = anno===null ? '' : '#'+ancora(anno, semestre);
  if(location.hash!==h){ try{ history.replaceState(null,'', h || location.pathname+location.search); }catch(e){} }
}
function scegliAnno(n, opz){
  opz = opz || {};
  if(!valido(n)) return;
  const cambiato = n!==anno;
  anno = n;
  if(cambiato) semestre = (opz.sem && daScegliere(n)) ? opz.sem : null;
  scriviIndirizzo();
  aggiornaTappe();
  if(sentieroAcceso) conduci(n);
  if(cambiato) disegnaPannello(true);
  if(opz.fuoco) $('#tab-'+n).focus();
  if(cambiato && !opz.fuoco) mostraSeSotto(elPannello);
}
function scegliSemestre(s){
  if(anno===null || !semestriDi(anno).includes(s)) return;
  semestre = s;
  scriviIndirizzo();
  disegnaPannello(false);
  const b = $(`.sem-scelta[data-sem="${s}"]`, elPannello); if(b) b.focus({preventScroll:true});
  mostraSeSotto($('#corsi-semestre'));
}
elPannello.addEventListener('click', e=>{ const b = e.target.closest('[data-sem]'); if(b) scegliSemestre(+b.dataset.sem); });

/* ---------- riprendi, numeri e novita' ---------- */
function disegnaRiprendi(){
  const r = recente();
  if(!r){ elRiprendi.hidden = true; elRiprendi.innerHTML = ''; return; }
  const {c,p} = r;
  const dettaglio = p.visti && p.tot
    ? `${fmt(p.visti)} di ${fmt(p.tot)} ${p.cosa} ${p.fatti}, ${fmt(p.consolidati)} ${plur(p.consolidati,p.cons[0],p.cons[1])}`
    : 'Studio iniziato';
  elRiprendi.innerHTML = `<a class="riprendi-card" href="${esc(c.href)}" style="--c:${esc(c.colore)}">
    <span class="rip-anello">${anello(p,72)}<span class="rip-pct">${p.pctVisti}%</span></span>
    <span class="rip-testo"><span class="rip-occhiello">Riprendi da dove eri rimasto</span><span class="rip-titolo">${esc(c.titolo)}</span><span class="rip-det">${dettaglio}${p.ultimo?' · ultimo studio '+quando(p.ultimo):''}</span></span>
    <span class="btn-grad">Continua ${FRECCIA}</span></a>`;
  elRiprendi.hidden = false;
}
function disegnaNumeri(){
  const pubb = CORSI.filter(c=>c.href);
  const t = pubb.reduce((a,c)=>{ const n=c.numeri||{}; a.f+=n.flashcard||0; a.d+=(n.quiz||0)+(n.verofalso||0); a.c+=n.casi||0; return a; }, {f:0,d:0,c:0});
  const voci = [[pubb.length, plur(pubb.length,'corso','corsi')]];
  if(t.f) voci.push([t.f,'flashcard']);
  if(t.d) voci.push([t.d,'domande']);
  if(t.c) voci.push([t.c,'casi clinici']);
  $('#numeri').innerHTML = voci.map(([n,l])=>`<div class="numero"><b data-n="${n}">${fmt(n)}</b><span>${l}</span></div>`).join('');
}
function contaSu(){
  if(RIDOTTO) return;
  $$('#numeri [data-n]').forEach(el=>{
    const fino = +el.dataset.n; if(fino<20) return;
    const t0 = performance.now(), durata = 1500;
    const passo = t=>{ const k=Math.min(1,Math.max(0,(t-t0)/durata)), e=1-Math.pow(1-k,4); el.textContent=fmt(fino*e); if(k<1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  });
}
function disegnaNovita(){
  const el = $('#novita');
  const ultimo = CORSI.filter(c=>c.href).sort((a,b)=>(b.ordine||0)-(a.ordine||0))[0];
  if(!ultimo){ el.hidden = true; return; }
  el.href = ultimo.href;
  el.innerHTML = `<span class="nv-et">${SCINTILLA}Nuovo</span><span class="nv-t">${esc(ultimo.titolo)} · ${dove(ultimo)}</span>${FRECCIA}`;
  el.hidden = false;
}

/* ---------- ricerca con suggerimenti ---------- */
const INDICE = CORSI.map(c=>({
  c,
  base: senzaAccenti([c.titolo, c.sigla, c.descrizione, (c.parole||[]).join(' '), (c.argomenti||[]).join(' ')].join(' ')),
  titolo: senzaAccenti(c.titolo),
  capitoli: (c.capitoli||[]).map(t=>({t, n:senzaAccenti(t)})),
  paragrafi: (c.paragrafi||[]).map(t=>({t, n:senzaAccenti(t)}))
}));
function evidenzia(testo, parole){
  // segna le lettere che corrispondono, ignorando maiuscole e accenti
  const piano = testo.split('').map(ch=>{ const x=senzaAccenti(ch); return x.length===1 ? x : (ch.toLowerCase().charAt(0) || ' '); }).join('');
  const segnate = new Array(testo.length).fill(false);
  parole.forEach(p=>{ let i=piano.indexOf(p); while(i>=0){ for(let j=i;j<i+p.length;j++) segnate[j]=true; i=piano.indexOf(p,i+p.length); } });
  let out = '', aperto = false;
  for(let i=0;i<testo.length;i++){
    if(segnate[i] && !aperto){ out+='<mark>'; aperto=true; }
    if(!segnate[i] && aperto){ out+='</mark>'; aperto=false; }
    out += esc(testo[i]);
  }
  return aperto ? out+'</mark>' : out;
}
function trova(parole){
  const trovati = [];
  INDICE.forEach(x=>{
    const tutto = [x.base].concat(x.capitoli.map(k=>k.n), x.paragrafi.map(k=>k.n)).join(' ');
    if(!parole.every(p=>tutto.includes(p))) return;
    const capitoli = x.capitoli.filter(k=>parole.every(p=>k.n.includes(p)));
    const paragrafi = capitoli.length ? [] : x.paragrafi.filter(k=>parole.every(p=>k.n.includes(p)));
    const punti = (parole.every(p=>x.titolo.includes(p))?4:0) + (parole.every(p=>x.base.includes(p))?2:0) + (capitoli.length||paragrafi.length?1:0) + (x.c.href?1:0);
    trovati.push({c:x.c, capitoli, paragrafi, punti});
  });
  return trovati.sort((a,b)=>b.punti-a.punti);
}
let risultati = [], attivo = -1, attesa = null;
function elencoTrovati(lista, uno, tanti, parole){
  if(!lista.length) return '';
  return `<span class="sug-cap">${lista.length===1?uno:tanti}: ${lista.slice(0,3).map(k=>evidenzia(k.t,parole)).join(', ')}${lista.length>3?` e altri ${lista.length-3}`:''}</span>`;
}
function sugHtml(r, i, parole){
  const c = r.c, tag = c.href ? 'a' : 'div';
  const cap = elencoTrovati(r.capitoli,'Capitolo','Capitoli',parole) || elencoTrovati(r.paragrafi,'Paragrafo','Paragrafi',parole);
  return `<${tag} class="sug" role="option" id="sug-${i}"${c.href?` href="${esc(c.href)}"`:''} aria-selected="false" style="--c:${esc(c.colore)}"><span class="orb mini" aria-hidden="true">${esc(c.sigla)}</span><span class="sug-testo"><span class="sug-titolo">${evidenzia(c.titolo,parole)}</span><span class="sug-dove">${dove(c)}${c.href?'':' · in arrivo'}</span>${cap}</span><span class="sug-freccia" aria-hidden="true">${FRECCIA}</span></${tag}>`;
}
function apriSug(){ elSug.hidden = false; elCerca.setAttribute('aria-expanded','true'); }
function chiudiSug(){ elSug.hidden = true; elCerca.setAttribute('aria-expanded','false'); elCerca.removeAttribute('aria-activedescendant'); attivo = -1; }
function evidenziaAttivo(){
  $$('.sug', elSug).forEach((el,i)=>el.setAttribute('aria-selected', String(i===attivo)));
  if(attivo>=0){ elCerca.setAttribute('aria-activedescendant','sug-'+attivo); const el=$('#sug-'+attivo); if(el) el.scrollIntoView({block:'nearest'}); }
  else elCerca.removeAttribute('aria-activedescendant');
}
function cerca(q){
  const parole = senzaAccenti(q).split(/\s+/).filter(Boolean);
  if(!parole.length){ risultati = []; chiudiSug(); return; }
  risultati = trova(parole);
  attivo = risultati.length ? 0 : -1;
  elSug.innerHTML = risultati.length
    ? risultati.map((r,i)=>sugHtml(r,i,parole)).join('') + '<div class="sug-aiuto" aria-hidden="true"><span><kbd>↑ ↓</kbd> per scegliere</span><span><kbd>Invio</kbd> per aprire</span><span><kbd>Esc</kbd> per chiudere</span></div>'
    : `<div class="sug-vuoto"><b>Nessun risultato per “${esc(q.trim())}”</b>Prova con il nome della materia o di un argomento.</div>`;
  evidenziaAttivo(); apriSug();
}
elCerca.addEventListener('input', ()=>{ clearTimeout(attesa); attesa = setTimeout(()=>cerca(elCerca.value), 50); });
elCerca.addEventListener('focus', ()=>{ if(elCerca.value.trim()) cerca(elCerca.value); });
elCerca.addEventListener('blur', ()=>{ setTimeout(()=>{ if(document.activeElement!==elCerca) chiudiSug(); }, 120); });
elCerca.addEventListener('keydown', e=>{
  const aperto = !elSug.hidden && risultati.length>0;
  if(e.key==='ArrowDown' && aperto){ e.preventDefault(); attivo = (attivo+1) % risultati.length; evidenziaAttivo(); }
  else if(e.key==='ArrowUp' && aperto){ e.preventDefault(); attivo = (attivo-1+risultati.length) % risultati.length; evidenziaAttivo(); }
  else if(e.key==='Enter'){
    e.preventDefault(); clearTimeout(attesa);
    if(elSug.hidden) cerca(elCerca.value);
    const r = risultati[attivo];
    if(r && r.c.href) location.href = r.c.href;
  }
  else if(e.key==='Escape'){ if(segnaposto){ e.preventDefault(); chiudiSpot(); } else if(!elSug.hidden) chiudiSug(); else elCerca.value = ''; }
});
elSug.addEventListener('mousedown', e=>e.preventDefault());   // il campo resta attivo mentre si clicca un risultato
elSug.addEventListener('mousemove', e=>{
  const el = e.target.closest('.sug'); if(!el) return;
  const i = $$('.sug', elSug).indexOf(el);
  if(i!==attivo){ attivo = i; evidenziaAttivo(); }
});
/* ---------- ricerca a tutto schermo ----------
   Se il campo di ricerca non e' sullo schermo (hai gia' scorso la pagina), la lente in alto e il tasto "/"
   lo portano al centro, sopra la pagina sfocata. E' lo stesso campo: viene spostato e poi rimesso al suo posto. */
const elBox = $('#cerca-box'), elSpot = $('#spotlight'), elSpotIn = $('#spotlight-in');
let segnaposto = null;
function ricercaSulloSchermo(){ const r = elBox.getBoundingClientRect(); return r.top >= 70 && r.bottom <= window.innerHeight - 20; }
function apriSpot(){
  if(!elSpot || !elSpotIn || segnaposto) return;
  segnaposto = document.createElement('div');
  segnaposto.className = 'cerca-segnaposto';
  segnaposto.style.height = elBox.offsetHeight + 'px';     // tiene il posto, cosi' la pagina sotto non si muove
  elBox.parentNode.insertBefore(segnaposto, elBox);
  elBox.classList.add('visto');
  elSpotIn.insertBefore(elBox, elSpotIn.firstChild);
  elSpot.hidden = false;
  elCerca.focus({preventScroll:true});
  if(elCerca.value.trim()) cerca(elCerca.value);
}
function chiudiSpot(){
  if(!segnaposto) return;
  chiudiSug();
  segnaposto.parentNode.insertBefore(elBox, segnaposto);
  segnaposto.remove(); segnaposto = null;
  elSpot.hidden = true;
  elCerca.blur();
}
function vaiAllaRicerca(){
  if(!segnaposto && !ricercaSulloSchermo() && elSpot && elSpotIn){ apriSpot(); return; }
  elCerca.focus({preventScroll:true});
}
if(elSpot){
  elSpot.addEventListener('mousedown', e=>{ if(e.target===elSpot) chiudiSpot(); });
  const x = $('#spotlight-chiudi'); if(x) x.addEventListener('click', chiudiSpot);
  // mentre la ricerca e' aperta la pagina sotto non scorre (l'elenco dei risultati si')
  const ferma = e=>{ if(!(e.target.closest && e.target.closest('.suggerimenti'))) e.preventDefault(); };
  elSpot.addEventListener('wheel', ferma, {passive:false});
  elSpot.addEventListener('touchmove', ferma, {passive:false});
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && segnaposto) chiudiSpot(); });
}
$('#nav-cerca').addEventListener('click', vaiAllaRicerca);
document.addEventListener('keydown', e=>{
  if(e.key!=='/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = document.activeElement;
  if(t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
  e.preventDefault(); vaiAllaRicerca();
});
// su telefono il suggerimento lungo non entra nel campo: uso quello corto
const strettoMq = window.matchMedia('(max-width:560px)');
const suggerimentoLungo = elCerca.placeholder;
function suggerimento(){ elCerca.placeholder = strettoMq.matches ? (elCerca.dataset.corto || suggerimentoLungo) : suggerimentoLungo; }
if(strettoMq.addEventListener) strettoMq.addEventListener('change', suggerimento);

/* ---------- interazioni sugli anni ---------- */
elSentiero.addEventListener('click', e=>{ const b=e.target.closest('[data-anno]'); if(b) scegliAnno(+b.dataset.anno); });
elSentiero.addEventListener('keydown', e=>{
  const tot = ANNI.length;
  let n = null;
  if(e.key==='ArrowRight') n = anno===null ? 0 : (anno+1)%tot;
  else if(e.key==='ArrowLeft') n = anno===null ? ULTIMO_ANNO : (anno+tot-1)%tot;
  else if(e.key==='Home') n = 0;
  else if(e.key==='End') n = ULTIMO_ANNO;
  if(n!==null){ e.preventDefault(); scegliAnno(n,{fuoco:true}); }
});
window.addEventListener('hashchange', ()=>{
  const d = daIndirizzo(); if(!d) return;
  if(d.anno!==anno) scegliAnno(d.anno, {sem:d.sem});
  else if(d.sem && d.sem!==semestre) scegliSemestre(d.sem);
});

/* ---------- fluorescenza: cellule che galleggiano nell'apertura ----------
   Corpi cellulari verdi (FITC) e magenta (TRITC), nuclei blu (DAPI): come in un'immunofluorescenza.
   I colori si sommano ("lighter"), il puntatore eccita le cellule vicine e le sposta appena. */
const CANALI = {dapi:true, fitc:true, tritc:true};
const RGB = {fitc:'61,245,166', tritc:'255,77,157', dapi:'91,140,255'};
function sprite(dim, disegna){ const c = document.createElement('canvas'); c.width = c.height = dim; disegna(c.getContext('2d'), dim/2); return c; }
function corpoCellula(g, m, rgb){
  let gr = g.createRadialGradient(m,m,0,m,m,m);
  gr.addColorStop(0,`rgba(${rgb},.2)`); gr.addColorStop(.5,`rgba(${rgb},.11)`); gr.addColorStop(.74,`rgba(${rgb},.04)`); gr.addColorStop(1,`rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0,0,m*2,m*2);
  g.beginPath();
  for(let i=0;i<=48;i++){ const a=i/48*Math.PI*2, r=m*(.58+Math.sin(a*3+1.3)*.03+Math.sin(a*5+.4)*.018), x=m+Math.cos(a)*r, y=m+Math.sin(a)*r; if(i) g.lineTo(x,y); else g.moveTo(x,y); }
  g.closePath();
  g.shadowColor = `rgba(${rgb},1)`; g.shadowBlur = 16; g.strokeStyle = `rgba(${rgb},.8)`; g.lineWidth = 2.4; g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = `rgba(${rgb},.22)`; g.lineWidth = 1;
  for(let i=0;i<8;i++){ const a=Math.random()*Math.PI*2, b=a+Math.PI*(.55+Math.random()*.7); g.beginPath(); g.moveTo(m+Math.cos(a)*m*.52, m+Math.sin(a)*m*.52); g.quadraticCurveTo(m+(Math.random()-.5)*m*.5, m+(Math.random()-.5)*m*.5, m+Math.cos(b)*m*.52, m+Math.sin(b)*m*.52); g.stroke(); }
  for(let i=0;i<16;i++){ const a=Math.random()*Math.PI*2, d=m*(.28+Math.random()*.27); g.fillStyle=`rgba(${rgb},${(.3+Math.random()*.55).toFixed(2)})`; g.beginPath(); g.arc(m+Math.cos(a)*d, m+Math.sin(a)*d, .8+Math.random()*1.8, 0, Math.PI*2); g.fill(); }
}
function nucleoCellula(g, m){
  const gr = g.createRadialGradient(m*.82,m*.78,0,m,m,m);
  gr.addColorStop(0,'rgba(200,218,255,.95)'); gr.addColorStop(.45,'rgba(91,140,255,.78)'); gr.addColorStop(.85,'rgba(60,100,230,.2)'); gr.addColorStop(1,'rgba(60,100,230,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(m,m,m*.95,m*.8,0,0,Math.PI*2); g.fill();
  for(let i=0;i<12;i++){ g.fillStyle=`rgba(225,235,255,${(.12+Math.random()*.3).toFixed(2)})`; g.beginPath(); g.arc(m+(Math.random()-.5)*m, m+(Math.random()-.5)*m*.8, 1.5+Math.random()*3.5, 0, Math.PI*2); g.fill(); }
}
let SPRITE = null;
function preparaSprite(){
  if(SPRITE) return;
  SPRITE = {fitc: sprite(256,(g,m)=>corpoCellula(g,m,RGB.fitc)), tritc: sprite(256,(g,m)=>corpoCellula(g,m,RGB.tritc)), nucleo: sprite(128, nucleoCellula)};
}
function Campo(cv, opz){ this.cv = cv; this.g = cv.getContext('2d'); this.opz = opz; this.celle = []; this.fili = []; this.granuli = []; this.p = null; this.visibile = true; this.w = 0; this.h = 0; }
Campo.prototype.misura = function(){
  const r = this.cv.getBoundingClientRect(); if(!r.width || !r.height) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const prima = this.w;
  this.w = r.width; this.h = r.height;
  this.cv.width = Math.round(r.width*dpr); this.cv.height = Math.round(r.height*dpr);
  this.g.setTransform(dpr,0,0,dpr,0,0);
  if(!prima || !this.celle.length){
    const o = this.opz, n = Math.max(o.min, Math.min(o.max, Math.round(this.w*this.h/o.area)));
    this.celle = []; for(let i=0;i<n;i++) this.celle.push(this.nuova());
    this.fili = []; for(let i=0;i<o.fili;i++) this.fili.push({y:Math.random()*this.h, a:18+Math.random()*50, f:.002+Math.random()*.004, fase:Math.random()*6.28, col:i%2?'tritc':'fitc'});
    this.granuli = []; for(let i=0;i<o.granuli;i++) this.granuli.push({x:Math.random()*this.w, y:Math.random()*this.h, r:.5+Math.random()*1.3, fase:Math.random()*6.28, col:['fitc','tritc','dapi'][i%3]});
  }
  return true;
};
Campo.prototype.nuova = function(){
  const o = this.opz, r = o.rMin + Math.random()*(o.rMax-o.rMin);
  return {x:Math.random()*this.w, y:Math.random()*this.h, r, vx:(Math.random()-.5)*o.vel, vy:(Math.random()-.5)*o.vel, rot:Math.random()*6.28, vr:(Math.random()-.5)*.002,
          fase:Math.random()*6.28, col:Math.random()<.55?'fitc':'tritc', nx:(Math.random()-.5)*.24, ny:(Math.random()-.5)*.24, ex:0};
};
Campo.prototype.disegna = function(t, fermo){
  const g = this.g, o = this.opz, w = this.w, h = this.h; if(!w) return;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0,0,w,h);
  g.globalCompositeOperation = 'lighter';
  this.fili.forEach(f=>{
    if(!CANALI[f.col]) return;
    g.strokeStyle = `rgba(${RGB[f.col]},${(o.alfa*.14).toFixed(3)})`; g.lineWidth = 1.1; g.beginPath();
    for(let x=-20;x<=w+20;x+=22){ const y = f.y + Math.sin(x*f.f + f.fase + t*.00025)*f.a; if(x===-20) g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  });
  const R = o.raggio, p = this.p;
  this.celle.forEach(c=>{
    if(!fermo){
      if(!RIDOTTO){ c.x += c.vx; c.y += c.vy; c.rot += c.vr; }   // con "riduci animazioni" niente deriva, solo la reazione al mouse
      // il puntatore spinge via le cellule vicine e le fa brillare; poi rallentano piano
      if(p){ const dx=c.x-p.x, dy=c.y-p.y, d=Math.hypot(dx,dy)||1; if(d<R){ const k=1-d/R; c.sx=(c.sx||0)+dx/d*k*o.spinta; c.sy=(c.sy||0)+dy/d*k*o.spinta; c.ex=Math.min(1,c.ex+k*.14); } }
      c.x += c.sx||0; c.y += c.sy||0; c.sx = (c.sx||0)*.9; c.sy = (c.sy||0)*.9;
      c.ex *= .965;
      const m = c.r*1.2;
      if(c.x<-m) c.x=w+m; else if(c.x>w+m) c.x=-m;
      if(c.y<-m) c.y=h+m; else if(c.y>h+m) c.y=-m;
    }
    const s = 1 + Math.sin(t*.0009 + c.fase)*.05;
    g.save(); g.translate(c.x, c.y); g.rotate(c.rot);
    g.globalAlpha = Math.min(1, o.alfa*(.72 + c.ex*.9));
    if(CANALI[c.col]) g.drawImage(SPRITE[c.col], -c.r*s, -c.r*s, c.r*2*s, c.r*2*s);
    if(CANALI.dapi){ const nr = c.r*.34*s; g.drawImage(SPRITE.nucleo, c.nx*c.r - nr, c.ny*c.r - nr*.85, nr*2, nr*1.7); }
    g.restore();
  });
  g.globalAlpha = 1;
  this.granuli.forEach(q=>{
    if(!CANALI[q.col]) return;
    const a = o.alfa*(.2 + .4*(1+Math.sin(t*.002+q.fase))/2);
    g.fillStyle = `rgba(${RGB[q.col]},${a.toFixed(3)})`; g.beginPath(); g.arc(q.x,q.y,q.r,0,6.283); g.fill();
  });
  if(p && o.laser){
    const gr = g.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
    gr.addColorStop(0,'rgba(150,185,255,.12)'); gr.addColorStop(1,'rgba(150,185,255,0)');
    g.fillStyle = gr; g.fillRect(p.x-R, p.y-R, R*2, R*2);
  }
};
const CAMPI = [];
let cicloAttivo = 0;
function ciclo(t){ CAMPI.forEach(c=>{ if(c.visibile && c.w) c.disegna(t,false); }); cicloAttivo = requestAnimationFrame(ciclo); }
function ridisegnaFermi(){ CAMPI.forEach(c=>{ if(c.w) c.disegna(0,true); }); }
function avviaFluorescenza(){
  const defs = [
    ['#campo-sfondo', {area:22000, min:12, max:44, rMin:24, rMax:64, vel:.22, alfa:.8, fili:4, granuli:80, raggio:240, spinta:.55, laser:true}]
  ];
  defs.forEach(([sel, opz])=>{
    const cv = $(sel); if(!cv || !cv.getContext) return;   // un canvas che manca non blocca gli altri
    const campo = new Campo(cv, opz); cv._campo = campo; CAMPI.push(campo);
  });
  if(!CAMPI.length) return;
  preparaSprite();
  CAMPI.forEach(c=>c.misura());
  if('ResizeObserver' in window){ const ro = new ResizeObserver(voci=>voci.forEach(v=>{ const c=v.target._campo; if(c && c.misura() && RIDOTTO) c.disegna(0,true); })); CAMPI.forEach(c=>ro.observe(c.cv)); }
  if('IntersectionObserver' in window){ const io = new IntersectionObserver(voci=>voci.forEach(v=>{ const c=v.target._campo; if(c) c.visibile = v.isIntersecting; })); CAMPI.forEach(c=>io.observe(c.cv)); }
  // il puntatore eccita le cellule in tutta l'apertura: si illuminano e scivolano via.
  // Con "riduci animazioni" le cellule restano ferme e si muovono solo quando passi col mouse.
  let spegni = 0;
  const accendi = ()=>{ clearTimeout(spegni); if(!cicloAttivo && !document.hidden) cicloAttivo = requestAnimationFrame(ciclo); };
  const fermaPiuTardi = ()=>{ if(!RIDOTTO) return; clearTimeout(spegni); spegni = setTimeout(()=>{ cancelAnimationFrame(cicloAttivo); cicloAttivo = 0; }, 2500); };
  if(PUNTATORE){
    const hero = $('.hero');
    hero.addEventListener('pointermove', e=>{
      CAMPI.forEach(c=>{ const r=c.cv.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top; c.p = (x>=0 && y>=0 && x<=r.width && y<=r.height) ? {x,y} : null; });
      if(RIDOTTO) accendi();
    });
    hero.addEventListener('pointerleave', ()=>{ CAMPI.forEach(c=>{ c.p = null; }); fermaPiuTardi(); });
  }
  if(RIDOTTO){ ridisegnaFermi(); }
  else{
    cicloAttivo = requestAnimationFrame(ciclo);
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden){ cancelAnimationFrame(cicloAttivo); cicloAttivo = 0; }
      else if(!cicloAttivo){ cicloAttivo = requestAnimationFrame(ciclo); }
    });
  }
}

/* ---------- movimento: comparsa, barra, luce ---------- */
const osserva = ('IntersectionObserver' in window) ? new IntersectionObserver(voci=>{
  voci.forEach(v=>{
    if(!v.isIntersecting) return;
    v.target.classList.add('visto');
    if(v.target===elSentiero && !sentieroAcceso){ sentieroAcceso = true; if(anno!==null) setTimeout(()=>conduci(anno), 350); }
    if(v.target.id==='numeri') setTimeout(contaSu, 200);
    osserva.unobserve(v.target);
  });
}, {rootMargin:'0px 0px -6% 0px', threshold:0.08}) : null;
$$('.rivela').forEach(el=>{ if(osserva) osserva.observe(el); else el.classList.add('visto'); });

const barraScroll = $('#barra-scroll');
const vociNav = $$('.nav-link a[href^="#"]').map(a=>({a, sez: $(a.getAttribute('href'))})).filter(v=>v.sez);
function suScorrimento(){
  elNav.classList.toggle('scorre', window.scrollY > 10);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if(barraScroll) barraScroll.style.transform = `scaleX(${max>0 ? Math.min(1, window.scrollY/max).toFixed(4) : 0})`;
  // la voce del menu si accende quando la sua sezione e' sullo schermo
  const soglia = window.scrollY + window.innerHeight*0.45;
  let attiva = null;
  vociNav.forEach(v=>{ if(v.sez.offsetTop <= soglia) attiva = v; });
  vociNav.forEach(v=>{ if(v===attiva) v.a.setAttribute('aria-current','true'); else v.a.removeAttribute('aria-current'); });
}
// indice degli anni nel piede: porta all'anno scelto
function disegnaPiedeAnni(){
  const el = $('#piede-anni'); if(!el) return;
  el.innerHTML = ANNI.map((a,n)=>{ const k = pubblicati(n).length; return `<a href="#${ancora(n)}" class="${k?'ha':''}" data-anno="${n}">${a.nome}${k?` · ${k}`:''}</a>`; }).join('');
  el.addEventListener('click', e=>{
    const a = e.target.closest('[data-anno]'); if(!a) return;
    e.preventDefault(); scegliAnno(+a.dataset.anno, {fuoco:true});
    const sez = $('#percorso'); if(sez) sez.scrollIntoView({behavior: RIDOTTO ? 'auto' : 'smooth', block:'start'});
  });
}
window.addEventListener('scroll', suScorrimento, {passive:true});

if(!RIDOTTO && PUNTATORE){
  // una luce morbida segue il puntatore su tutta la pagina
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
// alone di luce che segue il puntatore su schede e riquadri
document.addEventListener('pointermove', e=>{
  const el = e.target.closest && e.target.closest('.corso, .riprendi-card, .tile'); if(!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (e.clientX-r.left)+'px');
  el.style.setProperty('--my', (e.clientY-r.top)+'px');
}, {passive:true});
// le schede dei corsi si inclinano appena verso il puntatore, come un vetrino tra le dita
if(!RIDOTTO && PUNTATORE){
  let inclinata = null;
  const raddrizza = ()=>{ if(!inclinata) return; inclinata.classList.remove('inclina'); inclinata.style.removeProperty('--rx'); inclinata.style.removeProperty('--ry'); inclinata = null; };
  document.addEventListener('pointermove', e=>{
    const el = e.target.closest && e.target.closest('a.corso');
    if(inclinata && inclinata!==el) raddrizza();
    if(!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX-r.left)/r.width - .5, y = (e.clientY-r.top)/r.height - .5;
    el.style.setProperty('--ry', (x*6).toFixed(2)+'deg');
    el.style.setProperty('--rx', (-y*5).toFixed(2)+'deg');
    el.classList.add('inclina'); inclinata = el;
  }, {passive:true});
  document.documentElement.addEventListener('pointerleave', raddrizza);
}

/* ---------- titolo: le parole entrano una dopo l'altra ---------- */
function animaTitolo(){
  const h = $('#titolo'); if(!h) return;
  let i = 0;
  Array.from(h.childNodes).forEach(n=>{
    if(n.nodeType===3){
      const pezzi = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(pz=>{
        if(!pz) return;
        if(/^\s+$/.test(pz)){ pezzi.appendChild(document.createTextNode(' ')); return; }
        const s = document.createElement('span'); s.className = 'p'; s.style.setProperty('--i', i++); s.textContent = pz; pezzi.appendChild(s);
      });
      h.replaceChild(pezzi, n);
    } else if(n.nodeType===1){ n.classList.add('p'); n.style.setProperty('--i', i++); }
  });
  h.classList.add('pronto');
}

/* ---------- nastro degli argomenti: i capitoli di tutti i corsi che scorrono ---------- */
function disegnaNastro(){
  const el = $('#nastro'); if(!el) return;
  const liste = CORSI.filter(c=>c.href && (c.capitoli||[]).length).map(c=>c.capitoli.map(t=>({t, c})));
  const lungo = liste.reduce((m,l)=>Math.max(m,l.length), 0);
  const tutte = [];
  for(let i=0;i<lungo;i++) liste.forEach(l=>{ if(l[i]) tutte.push(l[i]); });   // un capitolo per corso, a turno
  if(tutte.length < 10){ el.hidden = true; return; }
  const voce = (x, copia)=>`<a class="nastro-voce" href="${esc(x.c.href)}" style="--c:${esc(x.c.colore)}" tabindex="-1"${copia?' aria-hidden="true"':''} title="${esc(x.c.titolo)}"><i></i>${esc(x.t)}</a>`;
  // con molti corsi i capitoli sono centinaia: sul nastro ne scorrono al massimo 140 (sempre a turno tra i corsi),
  // cosi' la striscia resta leggera; il numero sopra conta comunque tutti i capitoli
  const visibili = tutte.slice(0, 140);
  const meta = Math.ceil(visibili.length/2);
  [visibili.slice(0,meta), visibili.slice(meta)].forEach((riga,k)=>{   // due righe, con i corsi mescolati
    // l'elenco e' scritto due volte di fila: quando la prima copia e' uscita, la seconda e' al suo posto
    $('#nastro-'+(k+1)).innerHTML = `<div class="nastro-binario" style="--durata:${Math.round(riga.length*3.6)}s">${riga.map(x=>voce(x,false)).join('')}${riga.map(x=>voce(x,true)).join('')}</div>`;
  });
  $('#nastro-et').innerHTML = `<span>${fmt(tutte.length)}</span>capitoli dentro i corsi`;
  el.hidden = false;
}

/* ---------- aggiornamenti: tornando indietro da un corso, o studiando in un'altra scheda ---------- */
function aggiorna(){ disegnaRiprendi(); disegnaPannello(false); }
window.addEventListener('pageshow', e=>{ if(e.persisted){ chiudiSpot(); aggiorna(); } });
window.addEventListener('storage', aggiorna);

/* ---------- avvio ---------- */
animaTitolo();
suggerimento();
disegnaNastro();
disegnaPiedeAnni();
suScorrimento();
disegnaNovita();
disegnaNumeri();
disegnaRiprendi();
costruisciSentiero();
disegnaSentiero();
disegnaPannello(false);
if('ResizeObserver' in window){ new ResizeObserver(()=>disegnaSentiero()).observe(elSentiero); }
else window.addEventListener('resize', disegnaSentiero);
try{ avviaFluorescenza(); }catch(e){ /* senza canvas la pagina funziona lo stesso */ }
// con "riduci animazioni" le onde tra le sezioni restano ferme
if(RIDOTTO) $$('svg').forEach(s=>{ try{ s.pauseAnimations(); }catch(e){} });

// arrivando da un corso ("Tutti i corsi") si torna direttamente agli anni.
// Non quando ricarichi la pagina o torni indietro: li' il browser rimette la pagina dov'era.
const arrivo = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
const ricarica = arrivo ? (arrivo.type==='reload' || arrivo.type==='back_forward') : false;
// dalla lente delle altre pagine (./#cerca) si arriva con il campo di ricerca gia' pronto
if(location.hash==='#cerca'){
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){}
  window.scrollTo(0,0);
  setTimeout(()=>{ elCerca.focus({preventScroll:true}); }, 400);
}
if(daIndirizzo()!==null && !ricarica){
  let fermo = -1;
  const vai = ()=>{ const el=$('#percorso'); if(el){ el.scrollIntoView({block:'start', behavior:'instant'}); fermo = window.scrollY; } };
  vai();
  // quando arrivano i caratteri l'altezza dell'apertura cambia: riallineo, se nel frattempo non hai scorso tu
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ if(Math.abs(window.scrollY-fermo) < 4) vai(); });
}

// menu del telefono: si chiude scegliendo una voce, toccando fuori o con Esc
document.querySelectorAll('.menu-tel').forEach(m=>m.addEventListener('click', e=>{ if(e.target.closest('a')) m.open = false; }));
document.addEventListener('click', e=>{ document.querySelectorAll('.menu-tel[open]').forEach(m=>{ if(!m.contains(e.target)) m.open = false; }); });
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') document.querySelectorAll('.menu-tel[open]').forEach(m=>{ m.open = false; }); });
})();
