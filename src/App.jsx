import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Upload, ShieldCheck, UserCircle,
  Eye, EyeOff, Barcode, ScanFace, Loader2,
  Camera, ImageIcon, ClipboardList, Layers, ChevronDown,
  Settings, X
} from 'lucide-react';
import bwipjs from 'bwip-js';
import { removeBackground } from '@imgly/background-removal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genDD = () => {
  let dd = '000';
  for (let i = 0; i < 18; i++) dd += Math.floor(Math.random() * 10).toString();
  return dd;
};

const genDL = () => Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');

const loadImageFile = (file, setter) => {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => setter(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
};

const DEFAULT_INFO = {
  dlNo: '1234567890', dob: '1990-01-01',
  lastName: 'DOE', firstName: 'JOHN', middleName: '', suffix: '',
  address1: '123 MAIN ST', city: 'LAS VEGAS', state: 'NV', zip: '89101',
  class: 'C', end: 'NONE', rest: 'NONE',
  iss: '2025-01-01', exp: '2036-01-01',
  sex: '1', heightFeet: '5', heightInches: '10', wgt: '175',
  eyes: 'BRO', hair: 'BRN', dd: '0001234567890000000000', country: 'USA', compliance: 'F',
};

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      '#12121e',   // app background
  card:    '#1c1c2e',   // input / card surface
  accent:  '#5c5ef7',   // vivid indigo-blue buttons
  accentH: '#4a4ce0',   // hover
  label:   '#ffffff',   // label text
  muted:   '#8888aa',   // placeholder / chevron
  border:  '#2a2a42',   // subtle border
};

// ─── Reusable UI ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.card }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 transition-colors"
        style={{ background: 'transparent' }}>
        <h3 className="text-[13px] font-bold" style={{ color: T.label }}>{title}</h3>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: T.muted }} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const Field = ({ label, name, value, onChange, type = 'text', className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[13px] font-semibold" style={{ color: T.label }}>{label}</label>
    <input
      type={type} name={name} value={value} onChange={onChange}
      autoComplete="off" autoCorrect="off" spellCheck={false}
      className="w-full rounded-lg px-4 py-3 text-[14px] font-medium text-white outline-none transition-all appearance-none"
      style={{ background: '#252538', border: `1px solid ${T.border}` }}
      onFocus={e => e.target.style.borderColor = T.accent}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  </div>
);

const FieldWithBtn = ({ label, name, value, onChange, btnLabel, onBtn }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[13px] font-semibold" style={{ color: T.label }}>{label}</label>
    <div className="flex gap-2">
      <input
        type="text" name={name} value={value} onChange={onChange}
        autoComplete="off" autoCorrect="off" spellCheck={false}
        className="flex-1 rounded-lg px-4 py-3 text-[14px] font-medium text-white outline-none transition-all"
        style={{ background: '#252538', border: `1px solid ${T.border}` }}
        onFocus={e => e.target.style.borderColor = T.accent}
        onBlur={e => e.target.style.borderColor = T.border}
      />
      <button type="button" onClick={onBtn}
        className="text-white text-[13px] font-bold px-5 rounded-lg transition-colors shrink-0 active:opacity-80"
        style={{ background: T.accent }}>
        {btnLabel}
      </button>
    </div>
  </div>
);

const UploadBtn = ({ label, onChange, icon: Icon }) => (
  <div className="relative flex items-center justify-center gap-2 rounded-lg p-4 transition-colors active:opacity-70"
    style={{ background: '#252538', border: `1px solid ${T.border}` }}>
    <input type="file" onChange={onChange} accept="image/*"
      className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
    {Icon && <Icon className="w-4 h-4" style={{ color: T.muted }} />}
    <span className="text-[12px] font-semibold" style={{ color: T.muted }}>{label}</span>
  </div>
);

const Section = ({ title, children }) => (
  <div>
    <p className="text-[13px] font-bold mb-3" style={{ color: T.label }}>{title}</p>
    {children}
  </div>
);

// ─── Signature Pad ────────────────────────────────────────────────────────────
const SignaturePad = ({ onSave }) => {
  const padRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = padRef.current;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = padRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  };

  const stopDraw = () => { drawing.current = false; };

  const clear = () => {
    const canvas = padRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    const canvas = padRef.current;
    const img = new Image();
    img.onload = () => onSave(img);
    img.src = canvas.toDataURL('image/png');
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={padRef} width={600} height={180}
        className="w-full rounded-xl touch-none cursor-crosshair"
        style={{ background: '#1a1a2e', border: `1px solid ${T.border}` }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      <div className="flex gap-2">
        <button type="button" onClick={clear}
          className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors active:opacity-70"
          style={{ background: '#252538', color: T.muted, border: `1px solid ${T.border}` }}>
          Clear
        </button>
        <button type="button" onClick={save} disabled={!hasStrokes}
          className="flex-1 py-2 rounded-lg text-[12px] font-bold text-white transition-colors active:opacity-70 disabled:opacity-40"
          style={{ background: T.accent }}>
          Use Signature
        </button>
      </div>
    </div>
  );
};

// ─── Camera Capture Modal ─────────────────────────────────────────────────────
const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let fallbackTimer = null;
    const markReady = () => { if (active) setReady(true); };
    const start = async () => {
      try {
        let stream;
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false }); }
        catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const vid = videoRef.current;
        if (!vid) return;
        vid.srcObject = stream;
        ['loadedmetadata', 'loadeddata', 'canplay', 'playing'].forEach(e => vid.addEventListener(e, markReady, { once: true }));
        try { await vid.play(); } catch (_) {}
        fallbackTimer = setTimeout(markReady, 3000);
      } catch { if (active) setError('Camera access denied or unavailable.'); }
    };
    start();
    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => { if (blob) { onCapture(blob); onClose(); } }, 'image/png');
  }, [onCapture, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <button onClick={onClose}
        className="absolute top-4 left-4 bg-amber-500 text-black font-black text-sm px-4 py-2.5 rounded-xl z-10 flex items-center gap-1 shadow-lg">
        ← BACK
      </button>
      <div className="relative" style={{ width: 'min(92vw, 380px)', aspectRatio: '3/4' }}>
        <div className="absolute inset-0 border-4 border-blue-500 z-10 pointer-events-none rounded-lg" />
        <video ref={videoRef} className="w-full h-full object-cover bg-white rounded-lg" autoPlay playsInline muted />
        {!ready && !error && (
          <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-gray-500 font-bold text-sm">Starting camera…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white rounded-lg flex items-center justify-center z-20 p-6 text-center">
            <div className="text-red-500 font-bold text-sm">{error}</div>
          </div>
        )}
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 300 400" preserveAspectRatio="none">
          <ellipse cx="150" cy="165" rx="80" ry="108" fill="none" stroke="#22c55e" strokeWidth="2.5" />
          <line x1="150" y1="57" x2="150" y2="273" stroke="#22c55e" strokeWidth="2" />
          <line x1="62" y1="170" x2="238" y2="170" stroke="#22c55e" strokeWidth="2" />
          <rect x="78" y="153" width="144" height="34" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="8,5" />
          <line x1="100" y1="155" x2="100" y2="185" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="200" y1="155" x2="200" y2="185" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="78" y1="165" x2="100" y2="165" stroke="#ef4444" strokeWidth="2" />
          <line x1="200" y1="165" x2="222" y2="165" stroke="#ef4444" strokeWidth="2" />
          <line x1="138" y1="225" x2="162" y2="225" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="150" y1="219" x2="150" y2="231" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="90" y1="345" x2="90" y2="395" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="210" y1="345" x2="210" y2="395" stroke="#ef4444" strokeWidth="2.5" />
        </svg>
      </div>
      <button onClick={capture} disabled={!ready}
        className="mt-8 bg-amber-500 text-black font-black text-lg px-16 py-4 rounded-2xl shadow-lg disabled:opacity-40 tracking-widest uppercase active:scale-95 transition-transform">
        CAPTURE
      </button>
    </div>
  );
};

// ─── Photo Panel ──────────────────────────────────────────────────────────────
const PhotoPanel = ({
  backgroundImage, backBackgroundImage, referenceImage, showRef,
  setShowRef, setBackgroundImage, setBackBackgroundImage, setReferenceImage,
}) => (
  <div className="space-y-4 pb-4">
    <SectionCard title="Templates" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold" style={{ color: T.muted }}>Front</p>
          {backgroundImage && <img src={backgroundImage.src} className="w-full aspect-[1000/630] object-cover rounded-xl opacity-80" alt="front" />}
          <UploadBtn label="Replace" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setBackgroundImage)} icon={Upload} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold" style={{ color: T.muted }}>Back</p>
          {backBackgroundImage && <img src={backBackgroundImage.src} className="w-full aspect-[1000/630] object-cover rounded-xl opacity-80" alt="back" />}
          <UploadBtn label="Replace" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setBackBackgroundImage)} icon={Upload} />
        </div>
      </div>
    </SectionCard>

    <SectionCard title="Reference / Alignment" defaultOpen={false}>
      <UploadBtn label="Upload Reference" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setReferenceImage)} icon={Upload} />
      {referenceImage && (
        <button onClick={() => setShowRef(v => !v)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: showRef ? '#f59e0b' : '#252538', color: showRef ? '#000' : T.muted, border: `1px solid ${T.border}` }}>
          {showRef ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showRef ? 'Hide Overlay' : 'Show Overlay'}
        </button>
      )}
    </SectionCard>
  </div>
);

// ─── Info Panel — owns its own local state, debounces up to parent ─────────────
const InfoPanel = ({
  initialInfo, onInfoChange,
  photo, signature, isProcessingPhoto,
  setShowCamera, setPhoto, setSignature, handleAdvancedPhotoUpload,
}) => {
  const [f, setF] = useState(() => ({ ...initialInfo }));
  const debounceRef = useRef(null);

  const commit = useCallback((next) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onInfoChange(next), 250);
  }, [onInfoChange]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setF(prev => {
      const next = { ...prev, [name]: value.toUpperCase() };
      commit(next);
      return next;
    });
  }, [commit]);

  const setField = useCallback((name, value) => {
    setF(prev => {
      const next = { ...prev, [name]: value };
      commit(next);
      return next;
    });
  }, [commit]);

  const inputStyle = { background: '#252538', border: `1px solid ${T.border}` };

  return (
    <div className="pb-4">
      {/* 3-column grid — stacks to 1 col on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ── Left column ── */}
        <div className="space-y-5">
          <Section title="ID Number &amp; DOB">
            <FieldWithBtn label="DL Number" name="dlNo" value={f.dlNo} onChange={handleChange}
              btnLabel="GEN" onBtn={() => setField('dlNo', genDL())} />
            <div className="mt-3">
              <Field label="Date of Birth" name="dob" value={f.dob} onChange={handleChange} type="date" />
            </div>
          </Section>

          <Section title="Name">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" name="firstName" value={f.firstName} onChange={handleChange} />
              <Field label="Last Name"  name="lastName"  value={f.lastName}  onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Middle Name" name="middleName" value={f.middleName} onChange={handleChange} />
              <Field label="Suffix"      name="suffix"     value={f.suffix}     onChange={handleChange} />
            </div>
          </Section>

          <Section title="Photo">
            {photo && (
              <div className="w-24 h-32 mx-auto rounded-xl overflow-hidden mb-3"
                style={{ border: `2px solid ${T.accent}` }}>
                <img src={photo.src} className="w-full h-full object-cover" alt="id" />
              </div>
            )}
            <UploadBtn label="Upload Photo"
              onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setPhoto)}
              icon={ImageIcon} />
            <div className="flex gap-2 mt-2">
              <div className="relative flex-1 flex items-center justify-center gap-2 rounded-lg p-3 active:opacity-70 transition-colors"
                style={inputStyle}>
                <input type="file" accept="image/*" onChange={handleAdvancedPhotoUpload}
                  disabled={isProcessingPhoto}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
                {isProcessingPhoto
                  ? <><Loader2 className="w-4 h-4 animate-spin" style={{ color: T.accent }} /><span className="text-[11px] font-semibold" style={{ color: T.accent }}>Processing…</span></>
                  : <><ScanFace className="w-4 h-4" style={{ color: T.accent }} /><span className="text-[11px] font-semibold" style={{ color: T.accent }}>AI Remove BG</span></>}
              </div>
              <button onClick={() => setShowCamera(true)} disabled={isProcessingPhoto}
                className="flex items-center justify-center gap-2 rounded-lg px-4 disabled:opacity-40 active:opacity-70"
                style={inputStyle}>
                {isProcessingPhoto
                  ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: T.accent }} />
                  : <Camera className="w-5 h-5" style={{ color: T.accent }} />}
              </button>
            </div>
          </Section>
        </div>

        {/* ── Middle column ── */}
        <div className="space-y-5">
          <Section title="Address">
            <Field label="Street" name="address1" value={f.address1} onChange={handleChange} />
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="City"  name="city"  value={f.city}  onChange={handleChange} className="col-span-2" />
              <Field label="State" name="state" value={f.state} onChange={handleChange} />
            </div>
            <div className="mt-3">
              <Field label="Zip" name="zip" value={f.zip} onChange={handleChange} />
            </div>
          </Section>

          <Section title="Signature">
            {signature && (
              <div className="w-full h-16 rounded-xl overflow-hidden mb-3 flex items-center justify-center"
                style={{ background: '#1a1a2e', border: `1px solid ${T.border}` }}>
                <img src={signature.src} className="max-h-full object-contain" alt="sig" />
              </div>
            )}
            <SignaturePad onSave={setSignature} />
          </Section>

          <Section title="Audit">
            <FieldWithBtn label="DD Code" name="dd" value={f.dd} onChange={handleChange}
              btnLabel="GEN" onBtn={() => setField('dd', genDD())} />
            <div className="mt-3">
              <Field label="Compliance" name="compliance" value={f.compliance} onChange={handleChange} />
            </div>
          </Section>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          <Section title="License Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" name="class" value={f.class} onChange={handleChange} />
              <Field label="Rest"  name="rest"  value={f.rest}  onChange={handleChange} />
            </div>
            <div className="mt-3">
              <Field label="Issue Date" name="iss" value={f.iss} onChange={handleChange} type="date" />
            </div>
          </Section>

          <Section title="Physical">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold" style={{ color: T.label }}>Sex</label>
                <select name="sex" value={f.sex} onChange={handleChange}
                  className="w-full rounded-lg px-3 py-3 text-[14px] font-medium text-white outline-none appearance-none"
                  style={inputStyle}>
                  <option value="1">M — Male</option>
                  <option value="2">F — Female</option>
                  <option value="9">X — Non-binary</option>
                </select>
              </div>
              <Field label="Weight (lbs)" name="wgt" value={f.wgt} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Height Ft" name="heightFeet"   value={f.heightFeet}   onChange={handleChange} />
              <Field label="Height In" name="heightInches" value={f.heightInches} onChange={handleChange} />
              <Field label="Eyes"      name="eyes"         value={f.eyes}         onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Hair"    name="hair"    value={f.hair}    onChange={handleChange} />
              <Field label="Country" name="country" value={f.country} onChange={handleChange} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

// ─── Batch Panel ──────────────────────────────────────────────────────────────
const BatchPanel = ({ batchText, setBatchText, batchCount, setBatchCount, isBatching, onStart, onStop }) => (
  <div className="space-y-4 pb-4">
    <SectionCard title="Batch Processing" defaultOpen={false}>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">
        Format: FIRST:LAST:ADDRESS:CITY:STATE:ZIP:DOB
      </p>
      <textarea
        value={batchText} onChange={e => setBatchText(e.target.value)} disabled={isBatching}
        placeholder="JOHN:DOE:123 MAIN ST:LAS VEGAS:NV:89101:1/1/1990"
        className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-3 text-[13px] font-mono text-slate-300 outline-none focus:border-blue-500 h-36 resize-none"
      />
      <div className="flex gap-3 items-end mt-3">
        <div className="flex flex-col flex-1 gap-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider"># Lines</label>
          <input type="number" min="1" value={batchCount}
            onChange={e => setBatchCount(parseInt(e.target.value) || 1)}
            disabled={isBatching}
            className="bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-[15px] font-bold text-white outline-none focus:border-blue-500"
          />
        </div>
        {!isBatching
          ? <button onClick={onStart} className="bg-green-600 active:bg-green-700 text-white font-black px-6 py-3.5 rounded-xl active:scale-95">Start</button>
          : <button onClick={onStop}  className="bg-red-600 text-white font-black px-6 py-3.5 rounded-xl animate-pulse active:scale-95">Stop</button>}
      </div>
    </SectionCard>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
const App = () => {
  const canvasRef        = useRef(null);
  const backCanvasRef    = useRef(null);
  const barcodeCanvasRef = useRef(null);

  const [backgroundImage,     setBackgroundImage]     = useState(null);
  const [backBackgroundImage, setBackBackgroundImage] = useState(null);
  const [photo,       setPhoto]       = useState(null);
  const [signature,   setSignature]   = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [showRef,     setShowRef]     = useState(false);
  const [batchText,   setBatchText]   = useState('');
  const [batchCount,  setBatchCount]  = useState(1);
  const [isBatching,  setIsBatching]  = useState(false);
  const abortBatchRef = useRef(false);
  const [cardSide,    setCardSide]    = useState('front');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showCamera,   setShowCamera]   = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Canvas info — only updated from InfoPanel via debounce, not on every keypress
  const [info, setInfo] = useState({ ...DEFAULT_INFO });
  const infoRef = useRef(info);

  const handleInfoChange = useCallback((next) => {
    infoRef.current = next;
    setInfo(next);
  }, []);

  const fmt = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${m}/${dd}/${y}`; };

  const getDisplayInfo = (data) => {
    const parts = [data.firstName, data.middleName].filter(Boolean);
    const fullFirst = data.suffix
      ? `${parts.join(' ')}, ${data.suffix}`
      : parts.join(' ');
    return {
      ...data,
      dob: fmt(data.dob), iss: fmt(data.iss),
      exp: (() => { const d = data.dob; if (!d) return ''; const [,m,dd] = d.split('-'); return `${m}/${dd}/2036`; })(),
      address2: `${data.city}, ${data.state} ${data.zip}`.toUpperCase(),
      hgt: `${data.heightFeet}'-${String(data.heightInches).padStart(2,'0')}"`,
      sex: data.sex === '1' ? 'M' : data.sex === '2' ? 'F' : 'X',
      wgt: `${data.wgt} lbs`,
      firstName: fullFirst,
    };
  };

  const mapping = {
    dlNo:      { x: 47.7, y: 25.3, font: '700 24px "Arial Narrow",sans-serif' },
    dob:       { x: 44.7, y: 29.0, font: '700 24px "Arial Narrow",sans-serif' },
    lastName:  { x: 38.1, y: 34.2, font: '700 34px "Arial Narrow",sans-serif' },
    firstName: { x: 38.1, y: 39.4, font: '700 34px "Arial Narrow",sans-serif' },
    address1:  { x: 38.1, y: 44.0, font: '700 24px "Arial Narrow",sans-serif' },
    address2:  { x: 38.1, y: 47.8, font: '700 24px "Arial Narrow",sans-serif' },
    class:     { x: 47.4, y: 55.6, font: '700 21px "Arial Narrow",sans-serif' },
    end:       { x: 65.4, y: 55.6, font: '700 21px "Arial Narrow",sans-serif' },
    rest:      { x: 45.2, y: 59.1, font: '700 21px "Arial Narrow",sans-serif' },
    iss:       { x: 36.7, y: 69.1, font: '700 22px "Arial Narrow",sans-serif' },
    exp:       { x: 57.4, y: 69.1, font: '700 22px "Arial Narrow",sans-serif' },
    sex:       { x: 45.5, y: 73.9, font: '700 21px "Arial Narrow",sans-serif' },
    hgt:       { x: 45.5, y: 77.6, font: '700 21px "Arial Narrow",sans-serif' },
    wgt:       { x: 45.5, y: 81.5, font: '700 21px "Arial Narrow",sans-serif' },
    eyes:      { x: 45.5, y: 85.2, font: '700 21px "Arial Narrow",sans-serif' },
    hair:      { x: 45.5, y: 89.1, font: '700 21px "Arial Narrow",sans-serif' },
    bigDob:    { x: 58.7, y: 83.7, font: '700 54px "Helvetica","Arial",sans-serif', color: 'rgba(15,15,15,0.95)' },
    dd:        { x: 43.2, y: 93.8, font: '700 23px "Arial Narrow",sans-serif' },
  };

  useEffect(() => {
    const front = new Image(); front.onload = () => setBackgroundImage(front); front.src = '/FrontTemplate.jpg';
    const back  = new Image(); back.onload  = () => setBackBackgroundImage(back);  back.src  = '/BackTemplate.png';
  }, []);

  useEffect(() => {
    drawCanvas(info); generateBarcode(info); drawBackCanvas(info);
  }, [info, backgroundImage, backBackgroundImage, photo, signature, referenceImage, showRef]);

  const drawImageFit = (ctx, img, x, y, w, h, fit = 'cover') => {
    const ir = img.width / img.height, br = w / h;
    if (fit === 'cover') {
      let sx, sy, sw, sh;
      if (ir > br) { sw = img.height * br; sh = img.height; sx = (img.width - sw) / 2; sy = 0; }
      else          { sw = img.width; sh = img.width / br; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    } else {
      if (ir > br) { const s = w / img.width,  nh = img.height * s; ctx.drawImage(img, x, y + (h - nh) / 2, w, nh); }
      else          { const s = h / img.height, nw = img.width  * s; ctx.drawImage(img, x + (w - nw) / 2, y, nw, h); }
    }
  };

  const drawCanvas = (data) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const di = getDisplayInfo(data);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backgroundImage) ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (referenceImage && showRef) { ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(referenceImage, 0, 0, canvas.width, canvas.height); ctx.restore(); }
    if (photo && !showRef) {
      drawImageFit(ctx, photo, canvas.width * 0.075, canvas.height * 0.202, canvas.width * 0.265, canvas.height * 0.565, 'contain');
      ctx.save(); ctx.globalAlpha = 0.38; ctx.filter = 'grayscale(100%) brightness(1.25) contrast(0.85)';
      drawImageFit(ctx, photo, canvas.width * 0.835, canvas.height * 0.635, canvas.width * 0.115, canvas.height * 0.215, 'contain');
      ctx.restore();
    }
    if (signature && !showRef) ctx.drawImage(signature, canvas.width * 0.075, canvas.height * 0.816, canvas.width * 0.265, canvas.height * 0.094);
    if (!showRef) {
      ctx.textAlign = 'left';
      Object.keys(mapping).forEach(key => {
        const field = mapping[key]; ctx.font = field.font; ctx.fillStyle = field.color || '#151515';
        let text = di[key];
        if (key === 'bigDob') { const p = di.dob.split('/'); text = p.length === 3 && p[2].length === 4 ? `${p[0]}/${p[1]}/${p[2].substring(2)}` : di.dob; }
        if (text) ctx.fillText(text, (field.x / 100) * canvas.width, (field.y / 100) * canvas.height);
      });
    }
  };

  const drawBackCanvas = (data) => {
    const canvas = backCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const di = getDisplayInfo(data);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backBackgroundImage) ctx.drawImage(backBackgroundImage, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (barcodeCanvasRef.current?.width > 0)
      ctx.drawImage(barcodeCanvasRef.current, canvas.width * 0.43, canvas.height * 0.125, canvas.width * 0.53, canvas.height * 0.275);
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
    ctx.font = '700 20px Arial,Helvetica,sans-serif';
    ctx.fillText(di.dob, canvas.width * 0.103, canvas.height * 0.112);
    ctx.fillText(di.iss, canvas.width * 0.103, canvas.height * 0.153);
    ctx.font = '700 21px Arial,Helvetica,sans-serif';
    ctx.fillText(cap(di.end),  canvas.width * 0.486, canvas.height * 0.688);
    ctx.fillText(cap(di.rest), canvas.width * 0.461, canvas.height * 0.807);
  };

  const generateBarcode = (data) => {
    if (!barcodeCanvasRef.current) return;
    const fmtA = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${m}${d}${y}`; };
    const fmtH = (ft, i) => `${((parseInt(ft)||0)*12+(parseInt(i)||0)).toString().padStart(3,'0')} in`;
    const fmtZ = z => { let c = z.replace(/\D/g,''); return (c.length<9?c.padEnd(9,'0'):c).slice(0,9); };
    const p = {
      firstName: data.firstName.trim().toUpperCase(), middleName: data.middleName.trim().toUpperCase(),
      lastName: data.lastName.trim().toUpperCase(), suffix: data.suffix, dob: fmtA(data.dob),
      sex: data.sex, height: fmtH(data.heightFeet, data.heightInches), eyeColor: data.eyes,
      weight: data.wgt, address1: data.address1.trim().toUpperCase(), city: data.city.trim().toUpperCase(),
      state: data.state, zip: fmtZ(data.zip), country: data.country,
      dlNumber: data.dlNo.trim().toUpperCase(), issueDate: fmtA(data.iss),
      expDate: (() => { const d = data.dob; if (!d) return '20360101'; const [,m,dd] = d.split('-'); return `2036${m}${dd}`; })(),
      vehClass: data.class, restrictions: data.rest.trim().toUpperCase(),
      endorsements: data.end.trim().toUpperCase(), compliance: data.compliance,
      docDiscriminator: data.dd.trim(),
    };
    let payload = 'DL';
    const mand = ['DCA','DCB','DCD','DBA','DCS','DAC','DAD','DBD','DBB','DBC','DAY','DAU','DAG','DAI','DAJ','DAK','DAQ','DCF','DCG','DDE','DDF','DDG'];
    const add = (id, val) => { let v=val; if(!v){if(mand.includes(id))v='NONE';else return;} payload+=`${id}${v}\n`; };
    add('DAQ',p.dlNumber); add('DCS',p.lastName); add('DDE','N');
    add('DAC',p.firstName); add('DDF','N'); add('DAD',p.middleName);
    add('DDG','N'); add('DCU',p.suffix); add('DCA',p.vehClass);
    add('DCB',p.restrictions); add('DCD',p.endorsements); add('DBD',p.issueDate);
    add('DBB',p.dob); add('DBA',p.expDate); add('DBC',p.sex);
    add('DAU',p.height); add('DAY',p.eyeColor); add('DAG',p.address1);
    add('DAI',p.city); add('DAJ',p.state); add('DAK',p.zip);
    add('DCF',p.docDiscriminator); add('DCG',p.country);
    if (p.weight) add('DAW', p.weight.padStart(3,'0'));
    add('DDA',p.compliance); add('DDB',p.issueDate);
    payload = payload.slice(0,-1) + '\r';
    const header = `@\n\x1E\rANSI 636026110001DL0031${payload.length.toString().padStart(4,'0')}`;
    try { bwipjs.toCanvas(barcodeCanvasRef.current, { bcid:'pdf417', text:header+payload, columns:9, scale:3, eclevel:5, includetext:false }); }
    catch(e) { console.error(e); }
  };

  const handleAdvancedPhotoUpload = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const blob = await removeBackground(file, { model:'medium', output:{type:'image/png',quality:0.8} });
      loadImageFile(blob, img => { setPhoto(img); setIsProcessingPhoto(false); });
    } catch { setIsProcessingPhoto(false); loadImageFile(file, setPhoto); }
  }, []);

  const handleCameraCapture = useCallback(async (blob) => {
    setIsProcessingPhoto(true);
    try {
      const processed = await removeBackground(blob, { model:'medium', output:{type:'image/png',quality:0.8} });
      loadImageFile(processed, img => { setPhoto(img); setIsProcessingPhoto(false); });
    } catch { loadImageFile(blob, img => { setPhoto(img); setIsProcessingPhoto(false); }); }
  }, []);

  const dlBtn = (ref, name) => {
    const a = document.createElement('a'); a.download = name;
    a.href = ref.current.toDataURL('image/png', 1.0); a.click();
  };

  const startBatch = async () => {
    if (!batchText) return;
    setIsBatching(true); abortBatchRef.current = false;
    const lines = batchText.split('\n').filter(l => l.trim());
    const limit = Math.min(batchCount, lines.length);
    for (let i = 0; i < limit; i++) {
      if (abortBatchRef.current) break;
      const parts = lines[i].split(':'); if (parts.length < 7) continue;
      const [rawFirst, last, address1, city, state, zip, dobRaw] = parts;
      const fp = rawFirst.trim().split(' ');
      const dDob = (() => { const dp = dobRaw.trim().split('/'); return dp.length===3&&dp[2].length===4 ? `${dp[2]}-${dp[0].padStart(2,'0')}-${dp[1].padStart(2,'0')}` : dobRaw.trim(); })();
      const bI = { ...infoRef.current, firstName:fp[0].toUpperCase(), middleName:fp.slice(1).join(' ').toUpperCase(), lastName:last.trim().toUpperCase(), address1:address1.trim().toUpperCase(), city:city.trim().toUpperCase(), state:state.trim().toUpperCase(), zip:zip.trim(), dob:dDob, dlNo:genDL() };
      drawCanvas(bI); generateBarcode(bI); drawBackCanvas(bI);
      await new Promise(r => setTimeout(r, 500));
      dlBtn(canvasRef,     `${fp[0].toUpperCase()}_${last.trim().toUpperCase()}_${dDob.replace(/-/g,'')}_FRONT.png`);
      await new Promise(r => setTimeout(r, 800));
      dlBtn(backCanvasRef, `${fp[0].toUpperCase()}_${last.trim().toUpperCase()}_${dDob.replace(/-/g,'')}_BACK.png`);
      await new Promise(r => setTimeout(r, 1500));
    }
    setIsBatching(false);
  };

  return (
    <>
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}

      {/* ── Advanced Side Drawer ── */}
      {showAdvanced && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setShowAdvanced(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div className="relative z-50 flex flex-col overflow-y-auto w-80 h-full shadow-2xl"
            style={{ background: T.bg, borderLeft: `2px solid ${T.border}` }}
            onClick={e => e.stopPropagation()}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: T.muted }} />
                <span className="text-[13px] font-bold" style={{ color: T.label }}>Advanced</span>
              </div>
              <button onClick={() => setShowAdvanced(false)}
                className="p-1.5 rounded-lg active:opacity-60 transition-opacity"
                style={{ background: '#252538' }}>
                <X className="w-4 h-4" style={{ color: T.muted }} />
              </button>
            </div>
            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <PhotoPanel
                backgroundImage={backgroundImage} backBackgroundImage={backBackgroundImage}
                referenceImage={referenceImage} showRef={showRef}
                setShowRef={setShowRef} setBackgroundImage={setBackgroundImage}
                setBackBackgroundImage={setBackBackgroundImage} setReferenceImage={setReferenceImage}
              />
              <BatchPanel
                batchText={batchText} setBatchText={setBatchText}
                batchCount={batchCount} setBatchCount={setBatchCount}
                isBatching={isBatching} onStart={startBatch}
                onStop={() => { abortBatchRef.current = true; }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col text-white font-sans"
        style={{ height: '100dvh', overscrollBehavior: 'none', background: T.bg }}>

        {/* ── Header ── */}
        <header className="shrink-0 relative overflow-hidden"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)', paddingBottom: '0', borderBottom: '2px solid #006064', background: 'linear-gradient(135deg,#001a26 60%,#003545 100%)' }}>
          {/* Vegas skyline strip */}
          <div className="absolute bottom-0 left-0 right-0 h-10 opacity-20 bg-no-repeat bg-bottom bg-cover pointer-events-none"
            style={{ backgroundImage: 'url(/vegas-skyline.png)', backgroundSize: 'auto 100%' }} />
          <div className="relative flex items-center justify-between px-3 pb-2">
            {/* Nevada logo */}
            <img src="/nevada-logo.png" alt="Nevada 2026" className="h-10 object-contain" style={{ filter: 'drop-shadow(0 0 6px rgba(77,208,225,0.4))' }} />
            <div className="flex gap-2 items-center">
              <button onClick={() => setShowAdvanced(v => !v)}
                className="p-2 rounded-xl active:opacity-70 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                title="Advanced">
                <Settings className="w-4 h-4 text-white opacity-60" />
              </button>
              <button onClick={() => dlBtn(canvasRef, 'NV_ID_FRONT.png')}
                className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl font-black text-sm active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#006064,#0097a7)', boxShadow: '0 2px 12px rgba(0,150,167,0.4)' }}>
                <Download className="w-4 h-4" /><span>Front</span>
              </button>
              <button onClick={() => dlBtn(backCanvasRef, 'NV_ID_BACK.png')}
                className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl font-black text-sm active:scale-95"
                style={{ background: 'rgba(0,60,80,0.8)', border: '1px solid #006064' }}>
                <Download className="w-4 h-4" /><span>Back</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Card Preview ── */}
        <div className="shrink-0 px-3 pt-2 pb-1">
          <div className="flex gap-2 mb-1.5">
            {['front','back'].map(side => (
              <button key={side} onClick={() => setCardSide(side)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-all active:opacity-80"
                style={{ background: cardSide===side ? T.accent : T.card, color: cardSide===side ? '#fff' : T.muted }}>
                {side==='front' ? <UserCircle className="w-4 h-4" /> : <Barcode className="w-4 h-4" />}
                {side==='front' ? 'Front ID' : 'Back Barcode'}
              </button>
            ))}
          </div>
          <div className="flex justify-center">
            <div className="p-1.5 rounded-2xl shadow-xl"
              style={{ height: '140px', aspectRatio: '1000/630', background: T.card }}>
              <div className="relative rounded-xl overflow-hidden w-full h-full">
                <canvas ref={canvasRef}        width={1000} height={630} className={`absolute inset-0 w-full h-full ${cardSide==='front'?'block':'hidden'}`} />
                <canvas ref={backCanvasRef}    width={1000} height={630} className={`absolute inset-0 w-full h-full ${cardSide==='back'?'block':'hidden'}`} />
                <canvas ref={barcodeCanvasRef} style={{ display:'none' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable Panel ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-4"
          style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <InfoPanel
            initialInfo={DEFAULT_INFO} onInfoChange={handleInfoChange}
            photo={photo} signature={signature} isProcessingPhoto={isProcessingPhoto}
            setShowCamera={setShowCamera} setPhoto={setPhoto} setSignature={setSignature}
            handleAdvancedPhotoUpload={handleAdvancedPhotoUpload}
          />
        </div>
      </div>
    </>
  );
};

export default App;
