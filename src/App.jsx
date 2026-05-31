import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Upload, ShieldCheck, UserCircle,
  Eye, EyeOff, Barcode, ScanFace, Loader2,
  Camera, ImageIcon, ClipboardList, Layers
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
  dlNo: '2105922245', dob: '1981-03-13',
  lastName: 'VERZELLI', firstName: 'JOHN', middleName: 'JOSEPH', suffix: 'JR',
  address1: '2573 PALMERA CIR', city: 'LAS VEGAS', state: 'NV', zip: '89121-4016',
  class: 'C', end: 'NONE', rest: 'NONE',
  iss: '2025-08-21', exp: '2036-03-13',
  sex: '1', heightFeet: '5', heightInches: '7', wgt: '150',
  eyes: 'BRO', hair: 'BLK', dd: '000112114830826797247', country: 'USA', compliance: 'F',
};

// ─── Reusable UI ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, children }) => (
  <div className="bg-[#1e293b] rounded-2xl p-4 border border-slate-800">
    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, name, value, onChange, type = 'text', className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</label>
    <input
      type={type} name={name} value={value} onChange={onChange}
      autoComplete="off" autoCorrect="off" spellCheck={false}
      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-[15px] font-bold text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
    />
  </div>
);

const FieldWithBtn = ({ label, name, value, onChange, btnLabel, onBtn }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{label}</label>
    <div className="flex gap-2">
      <input
        type="text" name={name} value={value} onChange={onChange}
        autoComplete="off" autoCorrect="off" spellCheck={false}
        className="flex-1 bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3.5 text-[15px] font-bold text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
      />
      <button type="button" onClick={onBtn}
        className="bg-[#334155] hover:bg-[#475569] active:bg-[#1e293b] text-slate-200 text-[11px] font-black px-4 rounded-xl transition-colors shrink-0">
        {btnLabel}
      </button>
    </div>
  </div>
);

const UploadBtn = ({ label, onChange, icon: Icon }) => (
  <div className="relative flex items-center justify-center gap-2 border border-slate-700 rounded-2xl p-4 bg-[#0f172a] active:bg-[#1e293b] transition-colors">
    <input type="file" onChange={onChange} accept="image/*"
      className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
    {Icon && <Icon className="w-4 h-4 text-slate-400" />}
    <span className="text-[11px] font-black text-slate-400 uppercase">{label}</span>
  </div>
);

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
  backgroundImage, backBackgroundImage, photo, signature, referenceImage, showRef,
  isProcessingPhoto, setShowCamera, setShowRef, setPhoto, setSignature,
  setBackgroundImage, setBackBackgroundImage, setReferenceImage, handleAdvancedPhotoUpload,
}) => (
  <div className="space-y-4 pb-4">
    <SectionCard title="Templates">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Front</p>
          {backgroundImage && <img src={backgroundImage.src} className="w-full aspect-[1000/630] object-cover rounded-xl opacity-80 border border-slate-700" alt="front" />}
          <UploadBtn label="Replace" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setBackgroundImage)} icon={Upload} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Back</p>
          {backBackgroundImage && <img src={backBackgroundImage.src} className="w-full aspect-[1000/630] object-cover rounded-xl opacity-80 border border-slate-700" alt="back" />}
          <UploadBtn label="Replace" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setBackBackgroundImage)} icon={Upload} />
        </div>
      </div>
    </SectionCard>

    <SectionCard title="Photo">
      <div className="space-y-3">
        {photo && (
          <div className="w-24 h-32 mx-auto rounded-xl overflow-hidden border-2 border-blue-500">
            <img src={photo.src} className="w-full h-full object-cover" alt="id" />
          </div>
        )}
        <UploadBtn label="Upload Photo" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setPhoto)} icon={ImageIcon} />
        <div className="flex gap-3">
          <div className="relative flex-1 flex items-center justify-center gap-2 border border-dashed border-blue-500/40 bg-blue-500/5 rounded-2xl p-3.5 active:bg-blue-500/10 transition-colors">
            <input type="file" accept="image/*" onChange={handleAdvancedPhotoUpload} disabled={isProcessingPhoto}
              className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" />
            {isProcessingPhoto
              ? <><Loader2 className="w-4 h-4 animate-spin text-blue-400" /><span className="text-[11px] font-black text-blue-400 uppercase">Processing…</span></>
              : <><ScanFace className="w-4 h-4 text-blue-400" /><span className="text-[11px] font-black text-blue-400 uppercase">AI Remove BG</span></>}
          </div>
          <button onClick={() => setShowCamera(true)} disabled={isProcessingPhoto}
            className="flex items-center justify-center gap-2 border border-dashed border-blue-500/40 bg-blue-500/5 rounded-2xl px-5 active:bg-blue-500/10 transition-colors disabled:opacity-40">
            {isProcessingPhoto ? <Loader2 className="w-5 h-5 animate-spin text-blue-400" /> : <Camera className="w-5 h-5 text-blue-400" />}
          </button>
        </div>
      </div>
    </SectionCard>

    <SectionCard title="Signature">
      <UploadBtn label="Upload Signature" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setSignature)} icon={Upload} />
    </SectionCard>

    <SectionCard title="Reference / Alignment">
      <UploadBtn label="Upload Reference" onChange={e => e.target.files[0] && loadImageFile(e.target.files[0], setReferenceImage)} icon={Upload} />
      {referenceImage && (
        <button onClick={() => setShowRef(v => !v)}
          className={`mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all ${showRef ? 'bg-amber-500 text-black' : 'bg-[#0f172a] text-slate-400 border border-slate-700'}`}>
          {showRef ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showRef ? 'Hide Overlay' : 'Show Overlay'}
        </button>
      )}
    </SectionCard>
  </div>
);

// ─── Info Panel — owns its own local state, debounces up to parent ─────────────
const InfoPanel = ({ initialInfo, onInfoChange }) => {
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

  return (
    <div className="space-y-4 pb-4">
      <SectionCard title="ID Number & DOB">
        <FieldWithBtn label="DL Number" name="dlNo" value={f.dlNo} onChange={handleChange}
          btnLabel="GEN" onBtn={() => setField('dlNo', genDL())} />
        <div className="mt-3">
          <Field label="Date of Birth" name="dob" value={f.dob} onChange={handleChange} type="date" />
        </div>
      </SectionCard>

      <SectionCard title="Name">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name"  name="firstName"  value={f.firstName}  onChange={handleChange} />
          <Field label="Last Name"   name="lastName"   value={f.lastName}   onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Middle Name" name="middleName" value={f.middleName} onChange={handleChange} />
          <Field label="Suffix"      name="suffix"     value={f.suffix}     onChange={handleChange} />
        </div>
      </SectionCard>

      <SectionCard title="Address">
        <Field label="Street" name="address1" value={f.address1} onChange={handleChange} />
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="City"  name="city"  value={f.city}  onChange={handleChange} className="col-span-2" />
          <Field label="State" name="state" value={f.state} onChange={handleChange} />
        </div>
        <div className="mt-3">
          <Field label="Zip" name="zip" value={f.zip} onChange={handleChange} />
        </div>
      </SectionCard>

      <SectionCard title="License Details">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Class" name="class" value={f.class} onChange={handleChange} />
          <Field label="End"   name="end"   value={f.end}   onChange={handleChange} />
          <Field label="Rest"  name="rest"  value={f.rest}  onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Issue Date" name="iss" value={f.iss} onChange={handleChange} type="date" />
          <Field label="Exp Date"   name="exp" value={f.exp} onChange={handleChange} type="date" />
        </div>
      </SectionCard>

      <SectionCard title="Physical">
        <div className="grid grid-cols-5 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Sex</label>
            <select name="sex" value={f.sex} onChange={handleChange}
              className="bg-[#0f172a] border border-slate-700 rounded-xl px-2 py-3.5 text-[15px] font-bold text-white outline-none focus:border-blue-500">
              <option value="1">M</option>
              <option value="2">F</option>
              <option value="9">X</option>
            </select>
          </div>
          <Field label="Ft"   name="heightFeet"   value={f.heightFeet}   onChange={handleChange} />
          <Field label="In"   name="heightInches" value={f.heightInches} onChange={handleChange} />
          <Field label="Wgt"  name="wgt"          value={f.wgt}          onChange={handleChange} />
          <Field label="Eyes" name="eyes"         value={f.eyes}         onChange={handleChange} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Hair"    name="hair"    value={f.hair}    onChange={handleChange} />
          <Field label="Country" name="country" value={f.country} onChange={handleChange} />
        </div>
      </SectionCard>

      <SectionCard title="Audit">
        <FieldWithBtn label="DD Code" name="dd" value={f.dd} onChange={handleChange}
          btnLabel="GEN" onBtn={() => setField('dd', genDD())} />
        <div className="mt-3">
          <Field label="Compliance" name="compliance" value={f.compliance} onChange={handleChange} />
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Batch Panel ──────────────────────────────────────────────────────────────
const BatchPanel = ({ batchText, setBatchText, batchCount, setBatchCount, isBatching, onStart, onStop }) => (
  <div className="space-y-4 pb-4">
    <SectionCard title="Batch Processing">
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">
        Format: FIRST:LAST:ADDRESS:CITY:STATE:ZIP:SSN:DOB
      </p>
      <textarea
        value={batchText} onChange={e => setBatchText(e.target.value)} disabled={isBatching}
        placeholder="CHRISTOPHER:JOHNSON:1841 PRINCETON CT:BIRMINGHAM:AL:35211:423-45-3249:9/1/1995"
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
  const [showCamera,  setShowCamera]  = useState(false);
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
      dob: fmt(data.dob), iss: fmt(data.iss), exp: fmt(data.exp),
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
    ctx.fillText(di.dob, canvas.width * 0.113, canvas.height * 0.101);
    ctx.fillText(di.iss, canvas.width * 0.103, canvas.height * 0.150);
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
      dlNumber: data.dlNo.trim().toUpperCase(), issueDate: fmtA(data.iss), expDate: fmtA(data.exp),
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
      const parts = lines[i].split(':'); if (parts.length < 8) continue;
      const [rawFirst, last,,,,, ssn, dobRaw] = parts;
      const fp = rawFirst.trim().split(' ');
      const dDob = (() => { const dp = dobRaw.trim().split('/'); return dp.length===3&&dp[2].length===4 ? `${dp[2]}-${dp[0].padStart(2,'0')}-${dp[1].padStart(2,'0')}` : dobRaw.trim(); })();
      const bI = { ...infoRef.current, firstName:fp[0].toUpperCase(), middleName:fp.slice(1).join(' ').toUpperCase(), lastName:last.trim().toUpperCase(), dob:dDob, dlNo:genDL() };
      drawCanvas(bI); generateBarcode(bI); drawBackCanvas(bI);
      await new Promise(r => setTimeout(r, 500));
      dlBtn(canvasRef,     `${fp[0][0]}${last.trim()[0]}_${dDob.replace(/-/g,'')}_FRONT.png`);
      await new Promise(r => setTimeout(r, 800));
      dlBtn(backCanvasRef, `${fp[0][0]}${last.trim()[0]}_${ssn.trim().replace(/-/g,'')}_BACK.png`);
      await new Promise(r => setTimeout(r, 1500));
    }
    setIsBatching(false);
  };

  return (
    <>
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}

      <div className="flex flex-col bg-[#0f172a] text-slate-200 font-sans"
        style={{ height: '100dvh', overscrollBehavior: 'none' }}>

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center justify-between px-4"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: '10px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-900/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-white tracking-tight leading-none">NV ID STUDIO PRO</h1>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">AAMVA 2025</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => dlBtn(canvasRef, 'NV_ID_FRONT.png')}
              className="flex items-center gap-1.5 bg-blue-600 active:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-sm active:scale-95 shadow-lg shadow-blue-900/30">
              <Download className="w-4 h-4" /><span>Front</span>
            </button>
            <button onClick={() => dlBtn(backCanvasRef, 'NV_ID_BACK.png')}
              className="flex items-center gap-1.5 bg-[#1e293b] active:bg-[#334155] text-slate-300 px-4 py-2.5 rounded-xl font-black text-sm active:scale-95">
              <Download className="w-4 h-4" /><span>Back</span>
            </button>
          </div>
        </header>

        {/* ── Card Preview ── */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex gap-2 mb-2.5">
            {['front','back'].map(side => (
              <button key={side} onClick={() => setCardSide(side)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm transition-all ${cardSide===side ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#1e293b] text-slate-400'}`}>
                {side==='front' ? <UserCircle className="w-4 h-4" /> : <Barcode className="w-4 h-4" />}
                {side==='front' ? 'Front ID' : 'Back Barcode'}
              </button>
            ))}
          </div>
          <div className="bg-[#1e293b] p-2 rounded-2xl border border-slate-800 shadow-xl">
            <div className="relative aspect-[1000/630] rounded-xl overflow-hidden bg-[#0f172a]">
              <canvas ref={canvasRef}        width={1000} height={630} className={`w-full h-full object-contain bg-white ${cardSide==='front'?'block':'hidden'}`} />
              <canvas ref={backCanvasRef}    width={1000} height={630} className={`w-full h-full object-contain ${cardSide==='back'?'block':'hidden'}`} />
              <canvas ref={barcodeCanvasRef} style={{ display:'none' }} />
            </div>
          </div>
        </div>

        {/* ── Scrollable Panel ── */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-safe"
          style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <PhotoPanel
            backgroundImage={backgroundImage} backBackgroundImage={backBackgroundImage}
            photo={photo} signature={signature} referenceImage={referenceImage} showRef={showRef}
            isProcessingPhoto={isProcessingPhoto} setShowCamera={setShowCamera} setShowRef={setShowRef}
            setPhoto={setPhoto} setSignature={setSignature} setBackgroundImage={setBackgroundImage}
            setBackBackgroundImage={setBackBackgroundImage} setReferenceImage={setReferenceImage}
            handleAdvancedPhotoUpload={handleAdvancedPhotoUpload}
          />
          <InfoPanel initialInfo={DEFAULT_INFO} onInfoChange={handleInfoChange} />
          <BatchPanel
            batchText={batchText} setBatchText={setBatchText}
            batchCount={batchCount} setBatchCount={setBatchCount}
            isBatching={isBatching} onStart={startBatch}
            onStop={() => { abortBatchRef.current = true; }}
          />
        </div>
      </div>
    </>
  );
};

export default App;
