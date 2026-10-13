// KVLOG in OBS: a tiny web server on this computer that OBS loads as a Browser Source.
// It shows the live slide (text, pictures, videos, presentation slides) with the same
// transitions as the projector. Clear and Blackout make it transparent so the camera shows.
//
// Safety: it only listens on 127.0.0.1, only answers GET, checks the Host header (so other web
// pages cannot read it through DNS tricks), and only serves files from KVLOG's media folder.
import * as http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import type { OutputSlide, OutputSnapshot } from '../shared/output-types';
import { toRgba, type RenderBox } from '../shared/layout';
import type { OutputOverlay } from '../shared/overlay';
import type { LyricsSourceSettings, LyricsSourceState } from '../shared/obs-types';
import { isVideoFile } from '../shared/media';
import { pictureFrame } from '../shared/extras';
import { getLyricsSettings, isValidPort, setLyricsSettings } from './settings';
import { contentTypeFor, parseRange, resolveMediaFile } from './media';

export const LYRICS_SOURCE_NAME = 'KVLOG Output';
const MAX_CLIENTS = 16;
const HEARTBEAT_MS = 15000;
const BUILT_IN_BACKGROUNDS = ['black', 'midnight', 'slate', 'dusk'];

interface PageBox {
  x: number; y: number; w: number; h: number;
  role: string;
  fill: string | null; radius: number; border: string | null; alpha: number;
  src: string | null; video: boolean; fit: string;
  lines: string[]; columns: [string[], string[]] | null;
  font: string; size: number; color: string; bold: boolean; italic: boolean; upper: boolean;
  align: string; valign: string; lh: number; stroke: string | null; shadow: boolean;
}

type PageOverlay = Omit<OutputOverlay, 'file'> & { src: string | null; video: boolean };

interface Payload {
  visible: boolean;
  key: string;
  kind: string | null;
  lines: string[];
  footer: string | null;
  transition: 'fade' | 'cut';
  /** Built-in background id, or a /media/ address. */
  bg: { type: 'builtin' | 'image' | 'video'; value: string };
  page: string | null;
  columns: [string[], string[]] | null;
  /** Template boxes, ready to draw (colours already converted). */
  boxes: PageBox[] | null;
  /** Overlays meant for OBS, bottom first. */
  overlays: PageOverlay[];
  since: number;
  mode: 'full' | 'overlay';
  /** Picture position inside the OBS safe margins. */
  frame: { scale: number; x: number; y: number };
  guide: boolean;
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'">
<title>KVLOG Output</title>
<style>
html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}
body{font-family:'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif;color:#fff}
.layer{position:absolute;inset:0;overflow:hidden}
.layer.in{animation:fade .4s ease both}
.layer.out{animation:fadeout .4s ease both}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes fadeout{from{opacity:1}to{opacity:0}}
@keyframes slide{from{opacity:0;transform:translateX(-4vw)}}
@keyframes marquee{from{left:100%;transform:translate(0,-50%)}to{left:0;transform:translate(-100%,-50%)}}
#ovl{position:absolute;inset:0;overflow:hidden;z-index:5;pointer-events:none}
.bg-black{background:#000}
.bg-midnight{background:radial-gradient(ellipse at 50% 35%,#1b2b4b 0%,#0b1222 72%)}
.bg-slate{background:linear-gradient(180deg,#232b38 0%,#12161d 100%)}
.bg-dusk{background:radial-gradient(ellipse at 50% 115%,#3b2a24 0%,#150f0d 70%)}
.fill{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.contain{object-fit:contain;background:#000}
.body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6vw 8vw;text-align:center;box-sizing:border-box}
.dim{background:rgba(0,0,0,.38)}
.lines{display:flex;flex-direction:column;gap:.26em}
.lines p{margin:0;font-weight:600;line-height:1.22;text-wrap:balance;overflow-wrap:anywhere}
.k-scripture .lines p{font-size:.92em;font-weight:500;line-height:1.3}
.k-announcement .lines p:first-child{font-size:1.43em;font-weight:700}
.k-announcement .lines p+p{font-size:.7em;font-weight:400;color:rgba(255,255,255,.85)}
.footer{position:absolute;left:0;right:0;bottom:4.5vw;font-size:2.1vw;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)}
.ov{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;padding:0 6vw;text-align:center;box-sizing:border-box;text-shadow:0 2px 6px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9)}
.ov .lines p{line-height:1.25}
.ov .footer{position:static;margin-top:.5em;font-size:.5em}
.band{background:rgba(0,0,0,.6);padding-top:2.5vh;padding-bottom:2.5vh}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:4vw;width:100%;text-align:left}
.cols p{margin:0 0 .3em;font-weight:500;line-height:1.3;overflow-wrap:anywhere}
</style></head>
<body><div id="frame" style="position:absolute;left:0;top:0;width:100vw;height:100vh;transform-origin:0 0"><div id="stage"></div><div id="ovl"></div><div id="guide" style="display:none;position:absolute;inset:0;z-index:9;border:.3vw dashed #ffd166;box-sizing:border-box;pointer-events:none"><div style="position:absolute;left:50%;top:0;bottom:0;border-left:.15vw dashed rgba(255,209,102,.6)"></div><div style="position:absolute;top:50%;left:0;right:0;border-top:.15vw dashed rgba(255,209,102,.6)"></div><div style="position:absolute;left:1vw;top:1vw;font:600 1.4vw sans-serif;color:#ffd166;text-shadow:0 0 .3vw #000">KVLOG safe area (OBS)</div></div></div>
<script>
(function(){
  var q=new URLSearchParams(location.search);
  var forcedMode=q.get('mode');
  var pos=q.get('position')||'bottom';
  var size=Math.min(200,Math.max(16,parseInt(q.get('size')||'56',10)||56));
  var band=q.get('band')==='1';
  var TEXT=['song','scripture','announcement'];
  var stage=document.getElementById('stage');
  var shownKey=null;

  function fit(kind,lines){
    if(kind==='announcement')return 4.6;
    var chars=Math.max(1,lines.join('').length);
    return Math.max(2.4,Math.min(5.2,4.6*Math.sqrt(80/chars),30/(Math.max(1,lines.length)*1.3)));
  }
  function colFit(cols){
    var chars=Math.max(1,cols[0].join('').length,cols[1].join('').length);
    return Math.max(1.8,Math.min(3.6,3.2*Math.sqrt(60/chars)));
  }
  function textBlock(p,cls){
    var body=document.createElement('div');body.className=cls+' k-'+p.kind;
    var lines=document.createElement('div');lines.className=p.columns?'cols':'lines';
    if(p.columns){p.columns.forEach(function(col){var d=document.createElement('div');col.forEach(function(t){var e=document.createElement('p');e.textContent=t;d.appendChild(e);});lines.appendChild(d);});}
    else p.lines.forEach(function(t){var e=document.createElement('p');e.textContent=t;lines.appendChild(e);});
    body.appendChild(lines);
    if(p.footer){var f=document.createElement('div');f.className='footer';f.textContent=p.footer;body.appendChild(f);}
    return body;
  }
  function video(src,p,contain){
    var v=document.createElement('video');
    v.className='fill'+(contain?' contain':'');v.src=src;v.loop=true;v.playsInline=true;v.autoplay=true;
    v.muted=p.kind!=='media';
    v.addEventListener('loadedmetadata',function(){
      if(isFinite(v.duration)&&v.duration>0)v.currentTime=((Date.now()-p.since)/1000)%v.duration;
      var r=v.play();if(r&&r.catch)r.catch(function(){v.muted=true;v.play();});
    },{once:true});
    return v;
  }
  var JUST={top:'flex-start',middle:'center',bottom:'flex-end'};
  function drawBox(b,p){
    var d=document.createElement('div');var s=d.style;
    s.position='absolute';s.left=b.x+'%';s.top=b.y+'%';s.width=b.w+'%';s.height=b.h+'%';s.overflow='hidden';s.boxSizing='border-box';
    if(b.fill)s.background=b.fill;if(b.radius)s.borderRadius=b.radius+'vw';if(b.border)s.border=b.border;if(b.alpha<1)s.opacity=b.alpha;
    if(b.role==='image'){
      if(!b.src)return d;
      var m=b.video?video(b.src,p,false):document.createElement('img');
      if(!b.video)m.src=b.src;m.muted=true;
      m.style.cssText='position:static;width:100%;height:100%;display:block;object-fit:'+b.fit;
      d.appendChild(m);return d;
    }
    if(!b.lines.length)return d;
    var wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;height:100%;padding:.6vw;box-sizing:border-box;justify-content:'+(JUST[b.valign]||'center');
    var t=document.createElement('div');var ts=t.style;
    ts.width='100%';ts.fontFamily="'"+b.font+"','Segoe UI',sans-serif";ts.fontSize=b.size+'vw';ts.color=b.color;ts.fontWeight=b.bold?'700':'400';
    ts.fontStyle=b.italic?'italic':'normal';ts.textTransform=b.upper?'uppercase':'none';if(b.upper)ts.letterSpacing='.06em';
    ts.textAlign=b.align;ts.lineHeight=b.lh;ts.overflowWrap='anywhere';ts.textWrap='balance';
    if(b.stroke){ts.webkitTextStroke=b.stroke;ts.paintOrder='stroke fill';}
    if(b.shadow)ts.textShadow='0 .15vw .6vw rgba(0,0,0,.85),0 0 .2vw rgba(0,0,0,.6)';
    function para(text,first){var e=document.createElement('p');e.textContent=text;e.style.margin=first?'0':'.2em 0 0';return e;}
    if(b.columns){ts.display='grid';ts.gridTemplateColumns='1fr 1fr';ts.gap='3vw';
      b.columns.forEach(function(col){var c=document.createElement('div');col.forEach(function(l,i){c.appendChild(para(l,i===0));});t.appendChild(c);});}
    else b.lines.forEach(function(l,i){t.appendChild(para(l,i===0));});
    wrap.appendChild(t);d.appendChild(wrap);return d;
  }
  function build(p){
    var mode=forcedMode||p.mode;
    var layer=document.createElement('div');layer.className='layer';
    var overlay=mode==='overlay'&&TEXT.indexOf(p.kind)!==-1;
    if(overlay){
      var ov=textBlock(p,'ov'+(band?' band':''));
      ov.style.fontSize=size+'px';
      if(pos==='top')ov.style.top='6vh';else if(pos==='center'){ov.style.top='50%';ov.style.transform='translateY(-50%)';}else ov.style.bottom='6vh';
      layer.appendChild(ov);return layer;
    }
    var contain=p.kind==='media';
    if(p.bg.type==='builtin')layer.className+=' bg-'+p.bg.value;
    else{layer.className+=' bg-black';
      if(p.bg.type==='video')layer.appendChild(video(p.bg.value,p,contain));
      else{var i=document.createElement('img');i.className='fill'+(contain?' contain':'');i.src=p.bg.value;layer.appendChild(i);}
    }
    if(p.boxes){p.boxes.forEach(function(b){layer.appendChild(drawBox(b,p));});return layer;}
    if(p.page){var pg=document.createElement('img');pg.className='fill contain';pg.src=p.page;layer.appendChild(pg);}
    if(p.lines.length){
      var b=textBlock(p,'body'+(p.bg.type!=='builtin'?' dim':''));
      b.firstChild.style.fontSize=(p.columns?colFit(p.columns):fit(p.kind,p.lines)).toFixed(2)+'vw';
      layer.appendChild(b);
    }
    return layer;
  }
  function removeLater(el){setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},450);}
  function show(p){
    var key=p.visible?p.key+'|'+(forcedMode||p.mode):'hidden';
    if(key===shownKey)return;
    shownKey=key;
    var fade=p.transition!=='cut';
    var old=Array.prototype.slice.call(stage.children);
    if(!p.visible){
      old.forEach(function(el){if(fade){el.className+=' out';removeLater(el);}else stage.removeChild(el);});
      return;
    }
    var layer=build(p);
    if(fade&&old.length)layer.className+=' in';
    else if(fade&&!old.length)layer.className+=' in';
    stage.appendChild(layer);
    old.forEach(function(el){if(fade)removeLater(el);else stage.removeChild(el);});
  }
  // ----- Overlays -----
  var ovlBox=document.getElementById('ovl'),ovlEls={};
  function pad(n){return (n<10?'0':'')+n;}
  function rgba(h,a){return 'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')';}
  function el(tag,css,text){var e=document.createElement(tag);if(css)e.style.cssText=css;if(text!=null)e.textContent=text;return e;}
  function clockText(o){var d=new Date(),h=d.getHours(),suf='';if(!o.clock24){suf=h>=12?' PM':' AM';h=h%12||12;}return (o.clock24?pad(h):h)+':'+pad(d.getMinutes())+(o.clockSeconds?':'+pad(d.getSeconds()):'')+suf;}
  function secsLeft(o){var now=Date.now();if(o.countdownMode==='duration')return Math.max(0,Math.ceil((o.since+o.countdownMinutes*60000-now)/1000));var m=/^(\d{1,2}):(\d{2})$/.exec(o.countdownUntil);if(!m)return 0;var t=new Date();t.setHours(+m[1],+m[2],0,0);return Math.max(0,Math.ceil((t.getTime()-now)/1000));}
  function fmt(t){var h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return h>0?h+':'+pad(m)+':'+pad(s):pad(m)+':'+pad(s);}
  function tick(d){var o=d._o;if(o.kind==='clock'){d.textContent=clockText(o);return;}var t=secsLeft(o),done=t===0&&!!o.line2;d._tm.textContent=done?o.line2:fmt(t);d._tm.style.fontSize=(done?o.size*.6:o.size)+'vw';if(d._lab)d._lab.style.display=done?'none':'';}
  function drawOverlay(o){
    var d=el('div','position:absolute;left:'+o.x+'%;top:'+o.y+'%;width:'+o.w+'%;height:'+o.h+'%;opacity:'+o.alpha+";font-family:'"+o.font+"','Segoe UI',sans-serif;color:"+o.textColor+';box-sizing:border-box;animation:fade .35s ease both');
    var bg=o.bgOpacity>0?rgba(o.bgColor,o.bgOpacity):'transparent',rad=o.radius?o.radius+'vw':'0',sz=o.size+'vw';
    d._o=o;
    if(o.kind==='logo'||o.kind==='pip'){
      if(!o.src)return null;
      d.style.background=bg;d.style.borderRadius=rad;d.style.overflow='hidden';
      var m;if(o.video){m=document.createElement('video');m.muted=true;m.loop=true;m.autoplay=true;m.playsInline=true;}else m=document.createElement('img');
      m.src=o.src;m.style.cssText='width:100%;height:100%;display:block;object-fit:'+(o.kind==='pip'?'cover':'contain');d.appendChild(m);return d;
    }
    if(o.kind==='lowerThird'){
      d.style.display='flex';d.style.animation='slide .45s cubic-bezier(.2,.8,.2,1) both';
      d.appendChild(el('span','width:.45vw;flex-shrink:0;background:'+o.accentColor+';border-radius:'+rad));
      var p=el('div','flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:.25em;padding:0 1.4vw;background:'+bg+';border-radius:'+rad);
      p.appendChild(el('span','font-size:'+sz+';font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',o.line1));
      if(o.line2)p.appendChild(el('span','font-size:'+(o.size*.62)+'vw;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',o.line2));
      d.appendChild(p);return d;
    }
    if(o.kind==='clock'){
      d.style.display='grid';d.style.placeItems='center';d.style.fontWeight='600';d.style.fontVariantNumeric='tabular-nums';d.style.background=bg;d.style.borderRadius=rad;d.style.fontSize=sz;
      d.setAttribute('data-tick','1');tick(d);return d;
    }
    if(o.kind==='countdown'){
      d.style.display='flex';d.style.flexDirection='column';d.style.alignItems='center';d.style.justifyContent='center';d.style.gap='.4vw';d.style.textAlign='center';d.style.background=bg;d.style.borderRadius=rad;
      if(o.line1){d._lab=el('span','font-size:'+(o.size*.32)+'vw;letter-spacing:.08em;text-transform:uppercase;opacity:.85',o.line1);d.appendChild(d._lab);}
      d._tm=el('span','font-weight:700;line-height:1;font-variant-numeric:tabular-nums');d.appendChild(d._tm);
      d.setAttribute('data-tick','1');tick(d);return d;
    }
    if(o.kind==='ticker'){
      d.style.overflow='hidden';d.style.background=bg;d.style.borderRadius=rad;d.style.borderTop='.25vw solid '+o.accentColor;
      var secs=Math.max(4,((o.w/100+(o.line1.length*.55*o.size)/100)*60)/o.tickerSpeed);
      d.appendChild(el('span','position:absolute;top:50%;left:100%;white-space:nowrap;font-weight:600;font-size:'+sz+';transform:translateY(-50%);animation:marquee '+secs+'s linear infinite',o.line1));
      return d;
    }
    if(o.kind==='reference'){
      if(!o.refText)return null;
      d.style.display='flex';d.style.alignItems='center';d.style.padding='0 1.2vw';d.style.background=bg;d.style.borderRadius=rad;d.style.borderLeft='.35vw solid '+o.accentColor;
      d.appendChild(el('span','font-size:'+sz+';font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',o.refText));
      return d;
    }
    return null;
  }
  function showOverlays(list){
    var next={};
    list.forEach(function(o){
      var key=JSON.stringify(o),old=ovlEls[o.id];
      var d=old&&old.key===key?old.el:drawOverlay(o);
      if(d){next[o.id]={key:key,el:d};ovlBox.appendChild(d);}
    });
    Object.keys(ovlEls).forEach(function(id){var e=ovlEls[id].el;if(!next[id]||next[id].el!==e){if(e.parentNode)e.parentNode.removeChild(e);}});
    ovlEls=next;
  }
  setInterval(function(){Array.prototype.forEach.call(ovlBox.querySelectorAll('[data-tick]'),tick);},500);

  var es=new EventSource('/events');
  var frameEl=document.getElementById('frame'),guideEl=document.getElementById('guide');
  function place(p){var f=p.frame||{scale:1,x:0,y:0};frameEl.style.transform='translate('+f.x+'vw,'+f.y+'vh) scale('+f.scale+')';guideEl.style.display=p.guide?'block':'none';}
  es.onmessage=function(e){try{var p=JSON.parse(e.data);place(p);show(p);showOverlays(p.overlays||[]);}catch(err){}};
})();
</script></body></html>`;

const HIDDEN: Omit<Payload, 'mode' | 'overlays' | 'frame' | 'guide'> = {
  visible: false,
  key: '',
  kind: null,
  lines: [],
  footer: null,
  transition: 'fade',
  bg: { type: 'builtin', value: 'black' },
  page: null,
  columns: null,
  boxes: null,
  since: 0
};

function mediaPath(fileName: string): string {
  return `/media/${encodeURIComponent(fileName)}`;
}

function backgroundFor(slide: OutputSlide, media: Record<string, string>): Payload['bg'] {
  if (slide.background.startsWith('media:')) {
    const file = media[slide.background.slice('media:'.length)];
    if (file) return { type: isVideoFile(file) ? 'video' : 'image', value: mediaPath(file) };
    return { type: 'builtin', value: 'black' };
  }
  return { type: 'builtin', value: BUILT_IN_BACKGROUNDS.includes(slide.background) ? slide.background : 'black' };
}

function toPageBoxes(boxes: RenderBox[], media: Record<string, string>): PageBox[] {
  return boxes.slice(0, 40).map((b) => {
    const file = b.role === 'image' && b.mediaId ? media[b.mediaId] : undefined;
    const s = b.style;
    return {
      x: b.x, y: b.y, w: b.w, h: b.h,
      role: b.role,
      fill: b.fill ? toRgba(b.fill, b.opacity) : null,
      radius: b.radius,
      alpha: b.alpha,
      border: b.borderWidth ? `${b.borderWidth}vw solid ${toRgba(b.borderColor)}` : null,
      src: file ? mediaPath(file) : null,
      video: !!file && isVideoFile(file),
      fit: b.fit,
      lines: b.lines.slice(0, 40),
      columns: b.columns ? [b.columns[0].slice(0, 20), b.columns[1].slice(0, 20)] : null,
      font: s.font, size: b.fontSize, color: toRgba(s.color), bold: s.bold, italic: s.italic, upper: s.uppercase,
      align: s.align, valign: s.valign, lh: s.lineHeight,
      stroke: s.outlineWidth ? `${s.outlineWidth}vw ${toRgba(s.outlineColor)}` : null,
      shadow: s.shadow
    };
  });
}

function toPageOverlays(snapshot: OutputSnapshot | null): PageOverlay[] {
  if (!snapshot) return [];
  return snapshot.overlays
    .filter((o) => o.obs && (!snapshot.blackout || o.keepOnBlackout))
    .slice(0, 40)
    .map(({ file, ...rest }) => ({ ...rest, src: file ? mediaPath(file) : null, video: !!file && isVideoFile(file) }));
}

function toPayload(snapshot: OutputSnapshot | null, mode: Payload['mode']): Payload {
  // The OBS template (when one is chosen) replaces the projector's look.
  const live = (snapshot && snapshot.obsLive !== undefined ? snapshot.obsLive : snapshot?.live) ?? null;
  const overlays = toPageOverlays(snapshot);
  const frame = pictureFrame(snapshot?.screens?.obs);
  const guide = snapshot?.guide === true;
  if (!snapshot || snapshot.blackout || !live) return { ...HIDDEN, transition: live?.transition ?? 'fade', mode, overlays, frame, guide };
  const bg = backgroundFor(live.layout ? { ...live, background: live.layout.background } : live, snapshot.media);
  const boxes = live.layout ? toPageBoxes(live.layout.boxes, snapshot.media) : null;
  const page = live.image ? mediaPath(live.image) : null;
  const lines = live.lines.slice(0, 12);
  return {
    visible: true,
    // Changes whenever anything visible changes, so edits to a live slide show up too.
    key: JSON.stringify([live.itemId, live.index, lines, live.footer, bg, page, live.kind, boxes, snapshot.liveSince]),
    kind: live.kind,
    lines,
    footer: live.footer,
    transition: live.transition,
    bg,
    page,
    columns: live.columns ? [live.columns[0].slice(0, 12), live.columns[1].slice(0, 12)] : null,
    boxes,
    overlays,
    since: snapshot.liveSince,
    mode,
    frame,
    guide
  };
}

export class LyricsServer {
  private server: http.Server | null = null;
  private clients = new Set<http.ServerResponse>();
  private heartbeat: NodeJS.Timeout | null = null;
  private snapshot: OutputSnapshot | null = null;
  private payload = JSON.stringify(toPayload(null, 'full'));
  private running = false;
  private error: string | null = null;

  constructor(private readonly notify: (state: LyricsSourceState) => void) {}

  getState(): LyricsSourceState {
    const s = getLyricsSettings();
    return { ...s, running: this.running, url: this.url(s.port), error: this.error, clients: this.clients.size };
  }

  url(port = getLyricsSettings().port): string {
    return `http://127.0.0.1:${port}/output`;
  }

  async start(): Promise<void> {
    if (getLyricsSettings().enabled) await this.listen();
    else this.emit();
  }

  async saveSettings(input: unknown): Promise<LyricsSourceState> {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid OBS output settings.');
    const v = input as Partial<LyricsSourceSettings>;
    if (typeof v.enabled !== 'boolean') throw new Error('Invalid OBS output settings.');
    if (!isValidPort(v.port) || v.port < 1024) throw new Error('The port must be a number from 1024 to 65535.');
    if (v.mode !== 'full' && v.mode !== 'overlay') throw new Error('Invalid OBS output mode.');
    const before = getLyricsSettings();
    setLyricsSettings({ enabled: v.enabled, port: v.port, mode: v.mode });
    if (!v.enabled) await this.stop();
    else if (!this.running || before.port !== v.port) await this.listen();
    this.broadcast();
    this.emit();
    return this.getState();
  }

  publish(snapshot: OutputSnapshot | null): void {
    this.snapshot = snapshot;
    this.broadcast();
  }

  private broadcast(): void {
    const next = JSON.stringify(toPayload(this.snapshot, getLyricsSettings().mode));
    if (next === this.payload) return;
    this.payload = next;
    for (const res of this.clients) res.write(`data: ${next}\n\n`);
  }

  async stop(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const res of this.clients) res.end();
    this.clients.clear();
    const server = this.server;
    this.server = null;
    this.running = false;
    this.error = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    this.emit();
  }

  private emit(): void {
    this.notify(this.getState());
  }

  private async listen(): Promise<void> {
    await this.stop();
    const { port } = getLyricsSettings();
    const server = http.createServer((req, res) => void this.handle(req, res, port));
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      server.on('error', (e) => {
        this.error = `The OBS output stopped: ${(e as Error).message.slice(0, 200)}`;
        this.running = false;
        this.emit();
      });
      this.running = true;
      this.error = null;
      this.heartbeat = setInterval(() => {
        for (const res of this.clients) res.write(': ping\n\n');
      }, HEARTBEAT_MS);
    } catch (e) {
      this.server = null;
      this.running = false;
      const code = (e as NodeJS.ErrnoException).code;
      this.error = code === 'EADDRINUSE'
        ? `Port ${port} is already used by another program. Choose a different port.`
        : `Could not start the OBS output: ${(e as Error).message.slice(0, 200)}`;
    }
    this.emit();
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse, port: number): Promise<void> {
    const host = (req.headers.host ?? '').toLowerCase();
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    const path = (req.url ?? '/').split('?')[0];
    const common = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

    if (path === '/output' || path === '/lyrics' || path === '/') {
      res.writeHead(200, { ...common, 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
      return;
    }
    if (path === '/events') {
      if (this.clients.size >= MAX_CLIENTS) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, { ...common, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
      res.write(`retry: 2000\ndata: ${this.payload}\n\n`);
      this.clients.add(res);
      this.emit();
      req.on('close', () => {
        this.clients.delete(res);
        this.emit();
      });
      return;
    }
    if (path.startsWith('/media/')) {
      let fileName = '';
      try {
        fileName = decodeURIComponent(path.slice('/media/'.length));
      } catch {
        // falls through to 404
      }
      const full = resolveMediaFile(fileName);
      if (!full) {
        res.writeHead(404, common).end();
        return;
      }
      try {
        const { size } = await fs.stat(full);
        const range = parseRange(req.headers.range, size);
        const start = range?.start ?? 0;
        const end = range?.end ?? size - 1;
        const headers: http.OutgoingHttpHeaders = {
          'Content-Type': contentTypeFor(fileName),
          'Content-Length': size === 0 ? 0 : end - start + 1,
          'Accept-Ranges': 'bytes',
          'X-Content-Type-Options': 'nosniff'
        };
        if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        res.writeHead(range ? 206 : 200, headers);
        if (req.method === 'HEAD' || size === 0) {
          res.end();
          return;
        }
        const stream = createReadStream(full, { start, end });
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
      } catch {
        res.writeHead(404, common).end();
      }
      return;
    }
    res.writeHead(404, common).end();
  }
}
