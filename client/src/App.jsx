import { useState, useRef, useEffect } from 'react';

/* ── Icons ── */
const IcoCamera = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const IcoBack = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IcoCheck = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
    stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 6 5 9 10 3"/>
  </svg>
);

const IcoShare = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);


/* ── Constants ── */
const LOADING_MSGS = [
  'Reading your menu…',
  'Finding all the good stuff…',
  'Calculating the damage…',
  'Almost ready…',
];

/* ── Helpers ── */
const fmt = (n) => `£${(n || 0).toFixed(2)}`;

const groupBySection = (items) => {
  const map = {};
  const order = [];
  items.forEach((item, idx) => {
    const sec = (item.section || 'Other').trim();
    if (!map[sec]) { map[sec] = []; order.push(sec); }
    map[sec].push({ ...item, _i: idx });
  });
  return order.map(sec => ({ sec, items: map[sec] }));
};

/* ── API — proxied through Vite to http://localhost:3001 ── */
const scanMenu = async (base64, mediaType) => {
  const res = await fetch('/api/read-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
};

const scrapeMenu = async (url) => {
  const res = await fetch('/api/scrape-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
};

/* ── App ── */
export default function App() {
  const [screen, setScreen] = useState('home');
  const [fading, setFading] = useState(false);
  const [menu, setMenu] = useState([]);
  const [sel, setSel] = useState({});
  const [phase, setPhase] = useState('idle'); // idle | loading | error
  const [errMsg, setErrMsg] = useState('');
  const [tipPct, setTipPct] = useState(12.5);
  const [customTip, setCustomTip] = useState('');
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [toast, setToast] = useState(false);
  const [menuCount, setMenuCount] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const addMenuRef = useRef(null);
  const homeUploadRef = useRef(null);
  const [showHomeUrl, setShowHomeUrl] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [setMenus, setSetMenus] = useState([]);
  const [setMenuSels, setSetMenuSels] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [addMenuMode, setAddMenuMode] = useState(null); // null | 'options' | 'url'
  const [addMenuUrl, setAddMenuUrl] = useState('');
  const [menuNames, setMenuNames] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(null); // null | { current, total }
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [showSplit, setShowSplit] = useState(false);
  const [splitPeople, setSplitPeople] = useState(2);
  const [splitMode, setSplitMode] = useState('equal');
  const [sharing, setSharing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (phase !== 'loading') { setLoadingMsgIdx(0); return; }
    const id = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 2000);
    return () => clearInterval(id);
  }, [phase]);

  const go = (to, after) => {
    setFading(true);
    setTimeout(() => {
      setScreen(to);
      after?.();
      setFading(false);
    }, 300);
  };

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve({ base64: ev.target.result.split(',')[1], mediaType: file.type || 'image/jpeg' });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const processFiles = async (files) => {
    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) setLoadingProgress({ current: i + 1, total: files.length });
      const { base64, mediaType } = await readFileAsBase64(files[i]);
      const result = await scanMenu(base64, mediaType);
      if (i === 0) {
        setSel({});
        setMenuCount(1);
        setShowAddForm(false);
        setMenuNames([result.menuName || 'Menu']);
        if (result.type === 'set') {
          setMenu([]);
          setSetMenus([result]);
          setSetMenuSels([{ optionIdx: null, courses: {} }]);
        } else {
          if (!result.items?.length) throw new Error('No items found');
          setMenu(result.items);
          setSetMenus([]);
          setSetMenuSels([]);
        }
      } else {
        if (result.type === 'set') {
          setSetMenus(prev => [...prev, result]);
          setSetMenuSels(prev => [...prev, { optionIdx: null, courses: {} }]);
        } else {
          if (result.items?.length) setMenu(prev => [...prev, ...result.items]);
        }
        setMenuCount(c => c + 1);
        setMenuNames(prev => [...prev, result.menuName || 'Menu']);
      }
    }
    setLoadingProgress(null);
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setPhase('loading');
    setErrMsg('');
    try {
      await processFiles(files);
      go('menu');
      setPhase('idle');
    } catch {
      setErrMsg("Couldn't read menu — try a clearer screenshot");
      setPhase('error');
      setLoadingProgress(null);
    }
  };

  const handleHomeUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setPhase('loading');
    setErrMsg('');
    go('upload', async () => {
      try {
        await processFiles(files);
        go('menu');
        setPhase('idle');
      } catch {
        setErrMsg("Couldn't read menu — try a clearer screenshot");
        setPhase('error');
        setLoadingProgress(null);
      }
    });
  };

  const handleAddMenu = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      const mediaType = file.type || 'image/jpeg';

      setAdding(true);
      setAddError('');

      try {
        const result = await scanMenu(base64, mediaType);
        if (result.type === 'set') {
          setSetMenus(prev => [...prev, result]);
          setSetMenuSels(prev => [...prev, { optionIdx: null, courses: {} }]);
        } else {
          if (!result.items?.length) throw new Error('No items found');
          setMenu(prev => [...prev, ...result.items]);
        }
        setMenuCount(c => c + 1);
        setMenuNames(prev => [...prev, result.menuName || 'Menu']);
      } catch {
        setAddError("Couldn't read menu — try a clearer screenshot");
      } finally {
        setAdding(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddMenuUrl = async () => {
    const url = addMenuUrl.trim();
    if (!url) return;
    setAdding(true);
    setAddError('');
    setAddMenuMode(null);
    setAddMenuUrl('');
    try {
      const result = await scrapeMenu(url);
      if (result.type === 'set') {
        setSetMenus(prev => [...prev, result]);
        setSetMenuSels(prev => [...prev, { optionIdx: null, courses: {} }]);
      } else {
        if (!result.items?.length) throw new Error('No items found');
        setMenu(prev => [...prev, ...result.items]);
      }
      setMenuCount(c => c + 1);
      setMenuNames(prev => [...prev, result.menuName || 'Menu']);
    } catch {
      setAddError("Couldn't read menu from that URL");
    } finally {
      setAdding(false);
    }
  };

  const handleManualAdd = () => {
    const name = addName.trim();
    const price = parseFloat(addPrice);
    if (!name || isNaN(price) || price < 0) return;
    setMenu(prev => [...prev, { section: 'Added by You', name, description: '', price }]);
    setAddName('');
    setAddPrice('');
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    console.log('[scrape-menu] submitting url:', url);
    setPhase('loading');
    setErrMsg('');
    go('upload', async () => {
      try {
        const result = await scrapeMenu(url);
        setSel({});
        setMenuCount(1);
        setShowAddForm(false);
        setMenuNames([result.menuName || 'Menu']);
        if (result.type === 'set') {
          setMenu([]);
          setSetMenus([result]);
          setSetMenuSels([{ optionIdx: null, courses: {} }]);
        } else {
          if (!result.items?.length) throw new Error('No items found');
          setMenu(result.items);
          setSetMenus([]);
          setSetMenuSels([]);
        }
        go('menu');
        setPhase('idle');
      } catch (err) {
        setErrMsg(err.message || "Couldn't read menu from that URL");
        setPhase('error');
      }
    });
  };

  const toggle = (idx) => {
    setSel(prev => {
      if (prev[idx]) return prev; // already selected — use − to remove
      return { ...prev, [idx]: 1 };
    });
  };

  const selectSetOption = (menuIdx, optionIdx) => {
    setSetMenuSels(prev => prev.map((s, i) => i === menuIdx ? { ...s, optionIdx } : s));
  };

  const selectSetCourseItem = (menuIdx, courseIdx, itemIdx) => {
    setSetMenuSels(prev => prev.map((s, i) =>
      i === menuIdx ? { ...s, courses: { ...s.courses, [courseIdx]: itemIdx } } : s
    ));
  };

  const adjustQty = (idx, delta) => {
    setSel(prev => {
      const next = { ...prev };
      const newQty = (next[idx] || 0) + delta;
      if (newQty <= 0) delete next[idx]; else next[idx] = newQty;
      return next;
    });
  };

  const selKeys = Object.keys(sel);
  const alacarteSubtotal = selKeys.reduce((s, i) => s + (menu[i]?.price || 0) * (sel[i] || 1), 0);

  const setMenuLineItems = setMenus.flatMap((sm, mi) => {
    const s = setMenuSels[mi];
    if (s.optionIdx === null) return [];
    const opt = sm.options[s.optionIdx];
    const lines = [{ label: opt.label, price: opt.price, kind: 'base' }];
    Object.entries(s.courses).forEach(([ci, ii]) => {
      const item = sm.courses[Number(ci)]?.items[ii];
      if (item) lines.push({
        label: item.name,
        price: item.supplement || 0,
        kind: item.supplement > 0 ? 'supplement' : 'included',
      });
    });
    return lines;
  });

  const subtotal = alacarteSubtotal + setMenuLineItems.reduce((s, l) => s + l.price, 0);
  const tipAmt = subtotal * (tipPct / 100);
  const total = subtotal + tipAmt;
  const hasAnySelection = selKeys.length > 0 || setMenuSels.some(s => s.optionIdx !== null);
  const orderBarCount = selKeys.reduce((s, i) => s + (sel[i] || 0), 0) + setMenuSels.filter(s => s.optionIdx !== null).length;
  const totalItemCount = menu.length + setMenus.reduce((s, sm) =>
    s + sm.courses.reduce((cs, c) => cs + c.items.length, 0), 0
  );

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const W = 1080, H = 1920, PAD = 80, CW = W - PAD * 2;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Utilities
      const rRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      const trunc = (str, maxW) => {
        if (ctx.measureText(str).width <= maxW) return str;
        let s = str;
        while (ctx.measureText(s + '…').width > maxW && s.length > 0) s = s.slice(0, -1);
        return s + '…';
      };
      const divider = (yPos, alpha = 0.12) => {
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(PAD, yPos); ctx.lineTo(W - PAD, yPos); ctx.stroke();
      };
      const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
      const tf = (str, xPos, yPos, { size = 34, weight = '400', color = '#fff', align = 'center' } = {}) => {
        ctx.font = `${weight} ${size}px ${FONT}`;
        ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
        ctx.fillText(str, xPos, yPos);
      };

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1a0533'); bg.addColorStop(0.55, '#0d0520'); bg.addColorStop(1, '#0a0a1f');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Glow blobs
      [[W * 0.15, H * 0.08, 520, 'rgba(124,58,237,0.22)'],
       [W * 0.85, H * 0.8,  420, 'rgba(88,28,220,0.16)'],
       [W * 0.5,  H * 0.45, 600, 'rgba(109,40,217,0.07)'],
      ].forEach(([gx, gy, gr, gc]) => {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, gc); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });

      let y = 120;

      // Logo
      try {
        const logoImg = await new Promise((res, rej) => {
          const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = '/logo.png';
        });
        const SZ = 184, lx = (W - SZ) / 2;
        const lg = ctx.createRadialGradient(W / 2, y + SZ / 2, 0, W / 2, y + SZ / 2, 190);
        lg.addColorStop(0, 'rgba(139,92,246,0.6)'); lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg; ctx.fillRect(W / 2 - 220, y - 50, 440, SZ + 100);
        ctx.save(); rRect(lx, y, SZ, SZ, 42); ctx.clip();
        ctx.drawImage(logoImg, lx, y, SZ, SZ);
        ctx.restore();
        y += SZ + 44;
      } catch { y += 40; }

      // App name
      tf('Tab AI', W / 2, y, { size: 56, weight: '700' });
      y += 66;

      // Menu name
      if (menuNames.length) {
        ctx.font = `400 32px ${FONT}`;
        tf(trunc(menuNames.join(' · '), CW), W / 2, y, { size: 32, color: 'rgba(255,255,255,0.45)' });
        y += 54;
      }

      y += 18; divider(y); y += 52;

      // Items
      const MAX_ITEMS = 8;
      const allItems = [
        ...setMenuLineItems.map(l => ({
          name: l.kind === 'included' ? `  ${l.label}` : l.label,
          price: l.kind === 'included' ? null : l.price,
          sub: l.kind !== 'base',
        })),
        ...selKeys.map(i => {
          const item = menu[i]; if (!item) return null;
          const qty = sel[i] || 1;
          return { name: qty > 1 ? `${item.name} ×${qty}` : item.name, price: item.price * qty, sub: false };
        }).filter(Boolean),
      ];
      const shown = allItems.slice(0, MAX_ITEMS);
      const overflow = allItems.length - shown.length;

      for (const item of shown) {
        const sz = item.sub ? 30 : 34;
        const col = item.sub ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.88)';
        ctx.font = `400 ${sz}px ${FONT}`; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = col; ctx.textAlign = 'left';
        ctx.fillText(trunc(item.name, CW - 200), PAD, y);
        ctx.textAlign = 'right';
        if (item.price !== null) {
          ctx.font = `500 ${sz}px ${FONT}`; ctx.fillStyle = col;
          ctx.fillText(fmt(item.price), W - PAD, y);
        } else {
          ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillText('incl.', W - PAD, y);
        }
        y += 66;
      }
      if (overflow > 0) {
        tf(`+ ${overflow} more item${overflow !== 1 ? 's' : ''}`, W / 2, y,
          { size: 28, color: 'rgba(255,255,255,0.3)' });
        y += 52;
      }

      y += 14; divider(y); y += 50;

      // Summary rows
      const sumRow = (label, val, lc = 'rgba(255,255,255,0.5)', vc = 'rgba(255,255,255,0.72)') => {
        tf(label, PAD, y, { size: 34, color: lc, align: 'left' });
        tf(val, W - PAD, y, { size: 34, color: vc, align: 'right' });
        y += 60;
      };
      sumRow('Subtotal', fmt(subtotal));
      if (tipAmt > 0) sumRow(`Tip (${tipPct}%)`, fmt(tipAmt));

      divider(y - 6, 0.09); y += 42;

      // Total
      tf('Estimated Total', PAD, y, { size: 30, weight: '500', color: 'rgba(255,255,255,0.45)', align: 'left' });
      y += 20;
      tf(fmt(total), W - PAD, y + 84, { size: 100, weight: '800', color: '#a78bfa', align: 'right' });
      y += 114;

      // Split pill
      if (showSplit) {
        y += 20;
        const pillText = `Split ${splitPeople} ways — ${fmt(total / splitPeople)} each`;
        const pH = 76, pR = pH / 2;
        rRect(PAD, y, CW, pH, pR);
        ctx.fillStyle = 'rgba(124,58,237,0.22)'; ctx.fill();
        ctx.strokeStyle = 'rgba(167,139,250,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#c4b5fd';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(trunc(pillText, CW - 60), W / 2, y + pH / 2);
        y += pH + 24;
      }

      // Footer
      divider(H - 132, 0.07);
      tf('Know the bill. Enjoy the moment.', W / 2, H - 76,
        { size: 30, weight: '600', color: 'rgba(255,255,255,0.18)' });

      // Share or download
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'tab-ai.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Tab — Tab AI' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'tab-ai.png';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        setToastMsg('Image saved'); setToast(true); setTimeout(() => setToast(false), 2200);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setToastMsg('Could not share — try again'); setToast(true); setTimeout(() => setToast(false), 2500);
      }
    } finally {
      setSharing(false);
    }
  };

  const shareSplit = () => {
    const perPerson = total / splitPeople;
    const lines = [`Split Bill — ${splitPeople} people`, ''];
    if (splitMode === 'item') {
      setMenuLineItems.filter(l => l.kind !== 'included').forEach(l => {
        lines.push(`${l.label}: ${fmt(l.price / splitPeople)} each`);
      });
      selKeys.forEach(i => {
        const item = menu[i];
        if (!item) return;
        const qty = sel[i] || 1;
        lines.push(`${qty > 1 ? `${item.name} ×${qty}` : item.name}: ${fmt(item.price * qty / splitPeople)} each`);
      });
      lines.push('');
    }
    lines.push(`Each person pays: ${fmt(perPerson)}`);
    if (tipAmt > 0) lines.push(`(includes ${tipPct}% tip)`);
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: 'Split Bill', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setToastMsg('Copied to clipboard'); setToast(true); setTimeout(() => setToast(false), 2200);
      });
    }
  };

  const sections = groupBySection(menu);

  return (
    <div className="app">
      <div className={`screen-wrap${fading ? ' fade' : ''}`}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <div className="home">
            <div className="logo-wrap">
              <img src="/logo.png" className="logo-img" alt="Tab AI" />
            </div>
            <div className="tagline">Know the bill. Enjoy the moment.</div>
            <button
              className="btn-scan"
              onClick={() => go('upload', () => { setPhase('idle'); setErrMsg(''); setUrlInput(''); setShowHomeUrl(false); })}
            >
              Scan Menu
            </button>
            <div className="home-secondary">
              <button
                className="btn-secondary-action"
                onClick={() => homeUploadRef.current?.click()}
              >
                Upload Menu
              </button>
              <button
                className={`btn-secondary-action${showHomeUrl ? ' active' : ''}`}
                onClick={() => { setShowHomeUrl(v => !v); setUrlInput(''); }}
              >
                Paste URL
              </button>
            </div>
            {showHomeUrl && (
              <div className="url-row">
                <input
                  className="url-input"
                  type="text"
                  placeholder="Paste a menu URL…"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                  autoFocus
                />
                <button
                  className="url-go-btn"
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                >
                  Go
                </button>
              </div>
            )}
            <input
              ref={homeUploadRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleHomeUpload}
            />
          </div>
        )}

        {/* ── UPLOAD ── */}
        {screen === 'upload' && (
          <div className="upload">
            {phase === 'loading' ? (
              <div className="loading">
                <div className="loading-logo-wrap">
                  <div className="loading-glow" />
                  <img src="/logo.png" className="loading-logo" alt="" />
                  <div className="scan-line" />
                </div>
                <div className="loading-msg" key={loadingMsgIdx}>
                  {loadingProgress
                    ? `Reading menu ${loadingProgress.current} of ${loadingProgress.total}…`
                    : LOADING_MSGS[loadingMsgIdx]}
                </div>
              </div>
            ) : (
              <>
                <div className="upload-zone">
                  <input type="file" accept="image/*,.pdf" multiple onChange={handleFile} />
                  <div className="upload-cam"><IcoCamera /></div>
                  <div className="upload-label">Screenshot your menu</div>
                  <div className="upload-sub">Tap to choose an image</div>
                </div>
                {errMsg && <div className="error-box">{errMsg}</div>}
                <button className="back-link" onClick={() => go('home')}>Back</button>
              </>
            )}
          </div>
        )}

        {/* ── MENU ── */}
        {screen === 'menu' && (
          <div className="menu-screen">
            <div className="menu-hdr">
              <div className="menu-hdr-top">
                <button
                  className="icon-btn"
                  onClick={() => { setPhase('idle'); setErrMsg(''); setShowAddForm(false); go('upload'); }}
                >
                  <IcoBack />
                </button>
                <div className="menu-title">Menu</div>
                <button
                  className={`add-item-toggle${showAddForm ? ' active' : ''}`}
                  onClick={() => { setShowAddForm(v => !v); setAddName(''); setAddPrice(''); }}
                >
                  {showAddForm ? 'Cancel' : '+ Add Item'}
                </button>
              </div>
              {menuNames.length > 0 && (
                <div className="menu-name">{menuNames.join(' · ')}</div>
              )}
              <div className="menu-hdr-bottom">
                <div className="menu-meta">
                  {totalItemCount} item{totalItemCount !== 1 ? 's' : ''}
                  {menuCount > 1 && <span className="menu-count-pill"> · {menuCount} menus</span>}
                </div>
                {menuCount < 4 && (
                  adding ? (
                    <button className="add-menu-btn" disabled>
                      <span className="add-spinner" /> Reading…
                    </button>
                  ) : addMenuMode === 'options' ? (
                    <div className="add-menu-options">
                      <button className="add-menu-option-btn" onClick={() => { setAddMenuMode(null); addMenuRef.current?.click(); }}>Upload File</button>
                      <button className="add-menu-option-btn" onClick={() => setAddMenuMode('url')}>Paste URL</button>
                      <button className="add-menu-option-cancel" onClick={() => setAddMenuMode(null)}>✕</button>
                    </div>
                  ) : addMenuMode !== 'url' && (
                    <button className="add-menu-btn" onClick={() => setAddMenuMode('options')}>
                      <IcoPlus /> Add Menu
                    </button>
                  )
                )}
              </div>
              {addMenuMode === 'url' && (
                <div className="add-menu-url-row">
                  <input
                    className="add-menu-url-input"
                    type="text"
                    placeholder="Paste menu URL…"
                    value={addMenuUrl}
                    onChange={e => setAddMenuUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMenuUrl()}
                    autoFocus
                  />
                  <button className="add-menu-url-go" onClick={handleAddMenuUrl} disabled={!addMenuUrl.trim()}>Go</button>
                  <button className="add-menu-url-cancel" onClick={() => { setAddMenuMode(null); setAddMenuUrl(''); }}>✕</button>
                </div>
              )}
              {addError && <div className="add-error">{addError}</div>}
              <input
                ref={addMenuRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleAddMenu}
              />
            </div>

            {showAddForm && (
              <div className="add-item-form">
                <input
                  className="add-item-input"
                  placeholder="Item name"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                  autoFocus
                />
                <input
                  className="add-item-input add-item-price"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={addPrice}
                  onChange={e => setAddPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                />
                <button className="add-item-confirm" onClick={handleManualAdd}>Add</button>
              </div>
            )}

            <div className="menu-body">
              {setMenus.map((sm, mi) => (
                <div key={`sm-${mi}`} className="set-menu-block">
                  <div className="set-menu-badge">Set Menu</div>
                  <div className="price-options">
                    {sm.options.map((opt, oi) => (
                      <button
                        key={oi}
                        className={`price-option${setMenuSels[mi].optionIdx === oi ? ' on' : ''}`}
                        onClick={() => selectSetOption(mi, oi)}
                      >
                        <span className="price-option-label">{opt.label}</span>
                        <span className="price-option-price">{fmt(opt.price)}</span>
                      </button>
                    ))}
                  </div>
                  {sm.courses.map((course, ci) => (
                    <div key={ci} className="set-course">
                      <div className="set-course-name">{course.name}</div>
                      {course.items.map((item, ii) => (
                        <div
                          key={ii}
                          className={`set-item${setMenuSels[mi].courses[ci] === ii ? ' on' : ''}`}
                          onClick={() => selectSetCourseItem(mi, ci, ii)}
                        >
                          <div className="set-item-body">
                            <div className="set-item-name">{item.name}</div>
                            {item.description && <div className="item-desc">{item.description}</div>}
                          </div>
                          {item.supplement > 0 && (
                            <div className="supplement-badge">+{fmt(item.supplement)}</div>
                          )}
                          <div className="item-check">
                            {setMenuSels[mi].courses[ci] === ii && <IcoCheck />}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {sections.map(({ sec, items }) => (
                <div key={sec}>
                  <div className="sec-hdr">{sec}</div>
                  {items.map(item => (
                    <div
                      key={item._i}
                      className={`item-card${sel[item._i] ? ' on' : ''}`}
                      onClick={() => toggle(item._i)}
                    >
                      <div className="item-body">
                        <div className="item-name">{item.name}</div>
                        {item.description && (
                          <div className="item-desc">{item.description}</div>
                        )}
                      </div>
                      <div className="item-right">
                        <div className="item-price">{fmt(item.price)}</div>
                        {sel[item._i] ? (
                          <div className="item-qty-controls">
                            <button
                              className="item-qty-btn"
                              onClick={e => { e.stopPropagation(); adjustQty(item._i, -1); }}
                            >−</button>
                            <span className="item-qty-num">{sel[item._i]}</span>
                            <button
                              className="item-qty-btn"
                              onClick={e => { e.stopPropagation(); adjustQty(item._i, 1); }}
                            >+</button>
                          </div>
                        ) : (
                          <div className="item-check" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {hasAnySelection && (
              <div className="order-bar">
                <div className="order-inner">
                  <div className="order-info">
                    <div className="order-count">
                      {orderBarCount} selection{orderBarCount !== 1 ? 's' : ''}
                    </div>
                    <div className="order-sub">{fmt(subtotal)}</div>
                  </div>
                  <button className="btn-tab" onClick={() => go('tab')}>
                    View My Tab
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB ── */}
        {screen === 'tab' && (
          <div className="tab-screen">
            <div className="tab-hdr">
              <button className="icon-btn" onClick={() => go('menu')}>
                <IcoBack />
              </button>
              <div className="tab-title">My Tab</div>
            </div>

            <div className="tab-scroll">
              <div className="tab-body">
                {setMenuLineItems.map((line, i) => (
                  <div key={`sml-${i}`} className={`tab-row tab-row-${line.kind}`}>
                    <div className="tab-row-name">{line.label}</div>
                    <div className="tab-row-price">
                      {line.kind === 'included' ? 'incl.' : fmt(line.price)}
                    </div>
                  </div>
                ))}
                {selKeys.map(i => {
                  const item = menu[i];
                  if (!item) return null;
                  const qty = sel[i] || 1;
                  return (
                    <div key={i} className="tab-row">
                      <div className="tab-row-name">{item.name}</div>
                      <div className="tab-row-right">
                        <div className="qty-controls">
                          <button className="qty-btn" onClick={() => adjustQty(i, -1)}>−</button>
                          <span className="qty-num">{qty}</span>
                          <button className="qty-btn" onClick={() => adjustQty(i, 1)}>+</button>
                        </div>
                        <div className="tab-row-price">{fmt(item.price * qty)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="tab-summary">
                <div className="sum-row">
                  <span className="sum-label">Subtotal</span>
                  <span className="sum-val">{fmt(subtotal)}</span>
                </div>
                <div className="tip-section">
                  <div className="tip-label-row">
                    <span className="sum-label">Tip</span>
                    <div className="tip-pills">
                      {[0, 10, 12.5, 15].map(pct => (
                        <button
                          key={pct}
                          className={`tip-pill${!showCustomTip && tipPct === pct ? ' on' : ''}`}
                          onClick={() => { setTipPct(pct); setShowCustomTip(false); setCustomTip(''); }}
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      ))}
                      <button
                        className={`tip-pill${showCustomTip ? ' on' : ''}`}
                        onClick={() => setShowCustomTip(true)}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                  {showCustomTip && (
                    <div className="tip-custom-row">
                      <input
                        className="tip-custom-input"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={customTip}
                        onChange={e => {
                          setCustomTip(e.target.value);
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 0) setTipPct(v);
                        }}
                        autoFocus
                      />
                      <span className="tip-custom-pct">%</span>
                    </div>
                  )}
                </div>
                {tipAmt > 0 && (
                  <div className="sum-row">
                    <span className="sum-label">Tip amount</span>
                    <span className="sum-val">{fmt(tipAmt)}</span>
                  </div>
                )}
                <div className="sum-line" />
                <div className="total-row">
                  <span className="total-label">Estimated Total</span>
                  <span className="total-val">{fmt(total)}</span>
                </div>

                <button
                  className={`btn-split-toggle${showSplit ? ' open' : ''}`}
                  onClick={() => setShowSplit(v => !v)}
                >
                  Split Bill
                </button>

                <div className={`split-section${showSplit ? ' open' : ''}`}>
                  <div className="split-inner">
                    <div className="split-row">
                      <span className="split-label">Number of people</span>
                      <div className="qty-controls">
                        <button className="qty-btn" onClick={() => setSplitPeople(p => Math.max(2, p - 1))}>−</button>
                        <span className="qty-num">{splitPeople}</span>
                        <button className="qty-btn" onClick={() => setSplitPeople(p => Math.min(20, p + 1))}>+</button>
                      </div>
                    </div>

                    <div className="split-pills">
                      {['equal', 'item'].map(mode => (
                        <button
                          key={mode}
                          className={`tip-pill${splitMode === mode ? ' on' : ''}`}
                          onClick={() => setSplitMode(mode)}
                        >
                          {mode === 'equal' ? 'Equal Split' : 'By Item'}
                        </button>
                      ))}
                    </div>

                    {splitMode === 'item' && (
                      <div className="split-items">
                        {setMenuLineItems.filter(l => l.kind !== 'included').map((l, i) => (
                          <div key={`si-${i}`} className="split-item-row">
                            <span className="split-item-name">{l.label}</span>
                            <span className="split-item-each">{fmt(l.price / splitPeople)}</span>
                          </div>
                        ))}
                        {selKeys.map(i => {
                          const item = menu[i];
                          if (!item) return null;
                          const qty = sel[i] || 1;
                          return (
                            <div key={i} className="split-item-row">
                              <span className="split-item-name">{item.name}{qty > 1 ? ` ×${qty}` : ''}</span>
                              <span className="split-item-each">{fmt(item.price * qty / splitPeople)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="split-per-row">
                      <span className="split-per-label">Per person</span>
                      <span className="split-per-amount">{fmt(total / splitPeople)}</span>
                    </div>

                    <button className="btn-share-split" onClick={shareSplit}>
                      <IcoShare /> Share Split
                    </button>
                  </div>
                </div>
              </div>

              <div className="tab-actions">
                <button className="btn-share" onClick={share} disabled={sharing}>
                  {sharing ? 'Generating…' : <><IcoShare /> Share Tab</>}
                </button>
                <button className="btn-back-menu" onClick={() => go('menu')}>
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
