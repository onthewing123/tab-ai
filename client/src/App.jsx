import { useState, useRef } from 'react';

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
  const [svc, setSvc] = useState(true);
  const [toast, setToast] = useState(false);
  const [menuCount, setMenuCount] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const addMenuRef = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [setMenus, setSetMenus] = useState([]);
  const [setMenuSels, setSetMenuSels] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [addMenuMode, setAddMenuMode] = useState(null); // null | 'options' | 'url'
  const [addMenuUrl, setAddMenuUrl] = useState('');

  const go = (to, after) => {
    setFading(true);
    setTimeout(() => {
      setScreen(to);
      after?.();
      setFading(false);
    }, 220);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      const mediaType = file.type || 'image/jpeg';

      setPhase('loading');
      setErrMsg('');

      try {
        const result = await scanMenu(base64, mediaType);
        setSel({});
        setMenuCount(1);
        setShowAddForm(false);
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
      } catch {
        setErrMsg("Couldn't read menu — try a clearer screenshot");
        setPhase('error');
      }
    };
    reader.readAsDataURL(file);
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
      const next = { ...prev };
      if (next[idx]) delete next[idx]; else next[idx] = 1;
      return next;
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

  const selKeys = Object.keys(sel);
  const alacarteSubtotal = selKeys.reduce((s, i) => s + (menu[i]?.price || 0), 0);

  const setMenuLineItems = setMenus.flatMap((sm, mi) => {
    const s = setMenuSels[mi];
    if (s.optionIdx === null) return [];
    const opt = sm.options[s.optionIdx];
    const lines = [{ label: opt.label, price: opt.price }];
    Object.entries(s.courses).forEach(([ci, ii]) => {
      const item = sm.courses[Number(ci)]?.items[ii];
      if (item?.supplement > 0) lines.push({ label: `${item.name} supplement`, price: item.supplement });
    });
    return lines;
  });

  const subtotal = alacarteSubtotal + setMenuLineItems.reduce((s, l) => s + l.price, 0);
  const svcAmt = subtotal * 0.125;
  const total = subtotal + (svc ? svcAmt : 0);
  const hasAnySelection = selKeys.length > 0 || setMenuSels.some(s => s.optionIdx !== null);
  const orderBarCount = selKeys.length + setMenuSels.filter(s => s.optionIdx !== null).length;
  const totalItemCount = menu.length + setMenus.reduce((s, sm) =>
    s + sm.courses.reduce((cs, c) => cs + c.items.length, 0), 0
  );

  const share = () => {
    const setLines = setMenuLineItems.map(l => `${l.label}  ${fmt(l.price)}`);
    const alaLines = selKeys.map(i => `${menu[i].name}  ${fmt(menu[i].price)}`);
    const lines = [...setLines, ...alaLines];
    const text = [
      'My Tab', '',
      ...lines, '',
      `Subtotal: ${fmt(subtotal)}`,
      ...(svc ? [`Service (12.5%): ${fmt(svcAmt)}`] : []),
      `Total: ${fmt(total)}`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setToast(true);
      setTimeout(() => setToast(false), 2200);
    });
  };

  const sections = groupBySection(menu);

  return (
    <div className="app">
      <div className={`screen-wrap${fading ? ' fade' : ''}`}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <div className="home">
            <img src="/logo.png" className="logo-img" alt="Tab AI" />
            <div className="tagline">Scan a menu. Build your order.</div>
            <button
              className="btn-scan"
              onClick={() => go('upload', () => { setPhase('idle'); setErrMsg(''); setUrlInput(''); })}
            >
              Scan Menu
            </button>
            <div className="home-divider"><span>or</span></div>
            <div className="url-row">
              <input
                className="url-input"
                type="text"
                placeholder="Paste a menu URL…"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
              />
              <button
                className="url-go-btn"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
              >
                Go
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOAD ── */}
        {screen === 'upload' && (
          <div className="upload">
            {phase === 'loading' ? (
              <div className="loading">
                <div className="spinner" />
                <div className="loading-text">Reading your menu…</div>
              </div>
            ) : (
              <>
                <div className="upload-zone">
                  <input type="file" accept="image/*,.pdf" onChange={handleFile} />
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
                        <div className="item-check">
                          {sel[item._i] && <IcoCheck />}
                        </div>
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

            <div className="tab-body">
              {setMenuLineItems.map((line, i) => (
                <div key={`sml-${i}`} className={`tab-row${i > 0 && line.label.endsWith('supplement') ? ' tab-row-supplement' : ''}`}>
                  <div className="tab-row-name">{line.label}</div>
                  <div className="tab-row-price">{fmt(line.price)}</div>
                </div>
              ))}
              {selKeys.map(i => {
                const item = menu[i];
                if (!item) return null;
                return (
                  <div key={i} className="tab-row">
                    <div>
                      <div className="tab-row-name">{item.name}</div>
                      <div className="tab-row-qty">×1</div>
                    </div>
                    <div className="tab-row-price">{fmt(item.price)}</div>
                  </div>
                );
              })}
            </div>

            <div className="tab-summary">
              <div className="sum-row">
                <span className="sum-label">Subtotal</span>
                <span className="sum-val">{fmt(subtotal)}</span>
              </div>
              <div className="sum-row-svc">
                <span className="sum-label">Service (12.5%)</span>
                <div className="svc-right">
                  <span className="svc-amt">{fmt(svcAmt)}</span>
                  <button
                    className={`toggle${svc ? ' on' : ''}`}
                    onClick={() => setSvc(v => !v)}
                    aria-label="Toggle service charge"
                  >
                    <div className="toggle-dot" />
                  </button>
                </div>
              </div>
              <div className="sum-line" />
              <div className="total-row">
                <span className="total-label">Estimated Total</span>
                <span className="total-val">{fmt(total)}</span>
              </div>
            </div>

            <div className="tab-actions">
              <button className="btn-share" onClick={share}>
                <IcoShare /> Share Tab
              </button>
              <button className="btn-back-menu" onClick={() => go('menu')}>
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`toast${toast ? ' show' : ''}`}>Copied to clipboard</div>
    </div>
  );
}
