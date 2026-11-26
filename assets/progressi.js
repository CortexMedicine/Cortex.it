/* Cortex: sposta i progressi da un dispositivo all'altro (per esempio dal telefono al computer), senza account.
   I corsi salvano i progressi nel browser (localStorage). Qui si crea un file con quelli di tutti i corsi
   e, sull'altro dispositivo, lo si carica: i progressi vengono uniti, per ogni domanda vince la risposta piu' recente.
   Il file non passa da nessun server: resta tra i dispositivi di chi lo usa. */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const CORSI = ((window.CATALOGO || {}).corsi || []).filter(c => c.href && c.progressi && c.progressi.chiave);
const TOCCO = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const fmt = n => Number(n).toLocaleString('it-IT');
const plur = (n, uno, tanti) => fmt(n) + ' ' + (n === 1 ? uno : tanti);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function leggi(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function oggetto(raw){ try{ const o = JSON.parse(raw); return o && typeof o === 'object' ? o : null; }catch(e){ return null; } }

const elStato = $('#stato-qui'), btnCrea = $('#crea-file'), esitoCrea = $('#esito-crea');
const inFile = $('#carica-file'), elAnteprima = $('#anteprima'), esitoCarica = $('#esito-carica');
if(!btnCrea || !inFile) return;

// quante risposte, flashcard e simulazioni ci sono in un salvataggio
function conta(o){
  const prog = o && o.prog && typeof o.prog === 'object' ? o.prog : {};
  const esami = o && o.meta && Array.isArray(o.meta.exams) ? o.meta.exams.length : 0;
  return {voci: Object.keys(prog).length, esami};
}
function riassunto(n){
  const pezzi = [];
  if(n.voci) pezzi.push(plur(n.voci, 'esercizio', 'esercizi'));
  if(n.esami) pezzi.push(plur(n.esami, 'simulazione', 'simulazioni'));
  return pezzi.join(' e ') || 'nessun esercizio';
}
// i corsi con dei progressi in questo browser
function qui(){
  const out = [];
  CORSI.forEach(c => {
    const o = oggetto(leggi(c.progressi.chiave));
    if(!o) return;
    const n = conta(o);
    if(n.voci || n.esami) out.push({c, o, n});
  });
  return out;
}
function messaggio(el, html, tipo){
  el.innerHTML = html;
  el.className = 'sp-esito' + (tipo ? ' ' + tipo : '');
  el.hidden = false;
}
function disegnaStato(){
  const v = qui();
  if(!elStato) return;
  if(!v.length){
    elStato.innerHTML = 'Su questo dispositivo <b>non ci sono ancora progressi</b>. Se arrivi da un altro dispositivo, carica il suo file qui sotto.';
    return;
  }
  const tot = v.reduce((a, x) => ({voci: a.voci + x.n.voci, esami: a.esami + x.n.esami}), {voci: 0, esami: 0});
  elStato.innerHTML = 'Su questo dispositivo hai progressi in <b>' + plur(v.length, 'corso', 'corsi') + '</b>: ' + riassunto(tot) + '.';
}

/* ---------- 1) crea il file ---------- */
function nomeFile(){
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return 'cortex-progressi-' + d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '.json';
}
function scarica(file){
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
btnCrea.addEventListener('click', async () => {
  const v = qui();
  if(!v.length){
    messaggio(esitoCrea, 'Su questo dispositivo non ci sono ancora progressi da spostare.', 'ko');
    return;
  }
  const dati = {};
  v.forEach(x => { dati[x.c.progressi.chiave] = x.o; });
  const pacco = {app: 'cortex', tipo: 'progressi', versione: 1, creato: new Date().toISOString(), dati};
  const file = new File([JSON.stringify(pacco)], nomeFile(), {type: 'application/json'});
  const quanti = plur(v.length, 'corso', 'corsi');
  // sul telefono: condivisione (WhatsApp, email, Drive...); sul computer: download
  if(TOCCO && navigator.canShare && navigator.share){
    let puo = false;
    try{ puo = navigator.canShare({files: [file]}); }catch(e){}
    if(puo){
      try{
        await navigator.share({files: [file], title: 'Progressi di Cortex'});
        messaggio(esitoCrea, 'File inviato: contiene i progressi di ' + quanti + '. Ora aprilo sull\'altro dispositivo, da questa stessa pagina.', 'ok');
        return;
      }catch(e){
        if(e && e.name === 'AbortError') return;   // condivisione annullata
      }
    }
  }
  scarica(file);
  messaggio(esitoCrea, 'File salvato: <b>' + esc(file.name) + '</b>, con i progressi di ' + quanti + '. ' +
    (TOCCO ? 'Lo trovi nei download: mandalo all\'altro dispositivo, per esempio su WhatsApp o per email.'
           : 'Lo trovi nella cartella Download: mandalo all\'altro dispositivo, per esempio su WhatsApp o per email.'), 'ok');
});

/* ---------- 2) carica il file e unisci ---------- */
// per ogni domanda tiene il salvataggio piu' recente (campo t); le simulazioni si sommano senza doppioni;
// selezione, capitoli aperti e impostazioni restano quelli di questo dispositivo
function unisci(locale, arrivo){
  if(!locale) return arrivo;
  const out = Object.assign({}, locale);
  const pl = locale.prog && typeof locale.prog === 'object' ? locale.prog : {};
  const pa = arrivo.prog && typeof arrivo.prog === 'object' ? arrivo.prog : {};
  const prog = Object.assign({}, pl);
  for(const k in pa){
    const a = pa[k];
    if(!a || typeof a !== 'object') continue;
    const l = prog[k];
    if(!l || (+a.t || 0) > (+l.t || 0)) prog[k] = a;
  }
  out.prog = prog;
  const el = locale.meta && Array.isArray(locale.meta.exams) ? locale.meta.exams : [];
  const ea = arrivo.meta && Array.isArray(arrivo.meta.exams) ? arrivo.meta.exams : [];
  const perId = new Map();
  el.concat(ea).forEach(e => { if(e && e.id && !perId.has(e.id)) perId.set(e.id, e); });
  out.meta = Object.assign({}, locale.meta || {}, arrivo.meta && !locale.meta ? arrivo.meta : {},
    {exams: [...perId.values()].sort((x, y) => x.id - y.id).slice(-60)});
  ['sel', 'exp', 'opts', 'drafts'].forEach(k => { if(out[k] == null && arrivo[k] != null) out[k] = arrivo[k]; });
  return out;
}
let inArrivo = null;
function annulla(){
  inArrivo = null;
  elAnteprima.hidden = true;
  elAnteprima.innerHTML = '';
  inFile.value = '';
}
inFile.addEventListener('change', () => {
  const file = inFile.files && inFile.files[0];
  esitoCarica.hidden = true;
  if(!file) return;
  const r = new FileReader();
  r.onerror = () => messaggio(esitoCarica, 'Non riesco a leggere il file. Riprova.', 'ko');
  r.onload = () => {
    const pacco = oggetto(r.result);
    if(!pacco || pacco.app !== 'cortex' || pacco.tipo !== 'progressi' || !pacco.dati || typeof pacco.dati !== 'object'){
      annulla();
      messaggio(esitoCarica, 'Questo non è un file dei progressi di Cortex. Scegli il file <b>cortex-progressi-….json</b> creato sull\'altro dispositivo.', 'ko');
      return;
    }
    const voci = CORSI.map(c => ({c, o: pacco.dati[c.progressi.chiave]}))
      .filter(x => x.o && typeof x.o === 'object')
      .map(x => Object.assign(x, {n: conta(x.o)}))
      .filter(x => x.n.voci || x.n.esami);
    if(!voci.length){
      annulla();
      messaggio(esitoCarica, 'Nel file non ci sono progressi dei corsi di Cortex.', 'ko');
      return;
    }
    inArrivo = voci;
    const quando = pacco.creato ? new Date(pacco.creato) : null;
    const data = quando && !isNaN(quando) ? ' creato il ' + quando.toLocaleDateString('it-IT', {day: 'numeric', month: 'long'}) +
      ' alle ' + quando.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'}) : '';
    elAnteprima.innerHTML = '<p class="sp-ant-t">File' + esc(data) + ': progressi di <b>' + plur(voci.length, 'corso', 'corsi') + '</b></p>' +
      '<ul class="sp-lista">' + voci.map(x => '<li><span class="sp-orb" style="--c:' + esc(x.c.colore || '#5B8CFF') + '">' + esc(x.c.sigla || '') +
        '</span><span>' + esc(x.c.titolo) + '<small>' + riassunto(x.n) + '</small></span></li>').join('') + '</ul>' +
      '<p class="sp-nota">I progressi del file si aggiungono a quelli di questo dispositivo: non si perde niente. Se hai risposto alla stessa domanda su tutti e due, vale la risposta più recente.</p>' +
      '<div class="sp-azioni"><button type="button" class="btn-grad" id="unisci">Unisci i progressi</button><button type="button" class="btn-vetro" id="annulla">Annulla</button></div>';
    elAnteprima.hidden = false;
    $('#annulla').addEventListener('click', annulla);
    $('#unisci').addEventListener('click', applica);
    elAnteprima.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  };
  r.readAsText(file);
});
function applica(){
  if(!inArrivo) return;
  const fatti = [], falliti = [];
  inArrivo.forEach(({c, o}) => {
    const k = c.progressi.chiave;
    try{
      localStorage.setItem(k, JSON.stringify(unisci(oggetto(leggi(k)), o)));
      fatti.push(c);
    }catch(e){ falliti.push(c); }
  });
  annulla();
  disegnaStato();
  let html = '';
  if(fatti.length){
    html += '<b>Fatto!</b> Ho unito i progressi di ' + plur(fatti.length, 'corso', 'corsi') + '. Apri un corso per continuare da dove eri rimasto:' +
      '<span class="sp-vai">' + fatti.map(c => '<a href="' + esc(c.href) + '">' + esc(c.titolo) + '</a>').join('') + '</span>';
  }
  if(falliti.length){
    html += (html ? '<br>' : '') + 'Non sono riuscito a salvare ' + falliti.map(c => esc(c.titolo)).join(', ') +
      ': il browser non ha spazio o blocca il salvataggio (per esempio in navigazione anonima).';
  }
  messaggio(esitoCarica, html, fatti.length ? 'ok' : 'ko');
}

disegnaStato();
// se i progressi cambiano in un'altra scheda (per esempio studiando), lo stato si aggiorna
addEventListener('storage', e => { if(!e.key || /-allenamento-v1$|^ripasso/.test(e.key)) disegnaStato(); });
})();
