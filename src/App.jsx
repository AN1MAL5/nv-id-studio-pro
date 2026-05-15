import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Type, Download, Upload, ShieldCheck, UserCircle, Eye, EyeOff, FileText, Barcode, ScanFace, Loader2, Camera, X } from 'lucide-react';
import bwipjs from 'bwip-js';
import { removeBackground } from '@imgly/background-removal';

// ─── Camera Capture Modal ─────────────────────────────────────────────────────
const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setReady(true); };
        }
      } catch (e) {
        setError('Camera access denied or unavailable.');
      }
    };
    start();
    return () => {
      active = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      onCapture(blob);
      onClose();
    }, 'image/png');
  }, [onCapture, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Back button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 bg-[#f59e0b] text-black font-black text-base px-5 py-2 rounded z-10 flex items-center gap-1 shadow-lg"
      >
        &lt; BACK
      </button>

      {/* Camera viewport with face guide overlay */}
      <div className="relative" style={{ width: 'min(90vw, 420px)', aspectRatio: '3/4' }}>
        {/* Blue border frame */}
        <div className="absolute inset-0 border-4 border-blue-500 z-10 pointer-events-none rounded-sm" />

        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover bg-white"
          playsInline
          muted
        />

        {/* White overlay when not ready */}
        {!ready && !error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center z-20">
            <div className="text-gray-500 font-bold text-sm">Starting camera…</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center z-20 p-6 text-center">
            <div className="text-red-500 font-bold text-sm">{error}</div>
          </div>
        )}

        {/* Face alignment overlay — drawn in SVG over the video */}
        <svg
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          viewBox="0 0 300 400"
          preserveAspectRatio="none"
        >
          {/* Green face oval */}
          <ellipse
            cx="150" cy="165" rx="80" ry="108"
            fill="none" stroke="#22c55e" strokeWidth="2.5"
          />

          {/* Vertical center line */}
          <line x1="150" y1="57" x2="150" y2="273" stroke="#22c55e" strokeWidth="2" />

          {/* Horizontal eye-level line */}
          <line x1="62" y1="170" x2="238" y2="170" stroke="#22c55e" strokeWidth="2" />

          {/* Dashed eye zone rectangle */}
          <rect
            x="78" y="153" width="144" height="34"
            fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="8,5"
          />

          {/* Red left eye marker */}
          <line x1="100" y1="155" x2="100" y2="185" stroke="#ef4444" strokeWidth="2.5" />
          {/* Red right eye marker */}
          <line x1="200" y1="155" x2="200" y2="185" stroke="#ef4444" strokeWidth="2.5" />

          {/* Horizontal red eye tick (left) */}
          <line x1="78" y1="165" x2="100" y2="165" stroke="#ef4444" strokeWidth="2" />
          {/* Horizontal red eye tick (right) */}
          <line x1="200" y1="165" x2="222" y2="165" stroke="#ef4444" strokeWidth="2" />

          {/* Red nose marker */}
          <line x1="138" y1="225" x2="162" y2="225" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="150" y1="219" x2="150" y2="231" stroke="#ef4444" strokeWidth="1.5" />

          {/* Red shoulder markers */}
          <line x1="90" y1="345" x2="90" y2="395" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="210" y1="345" x2="210" y2="395" stroke="#ef4444" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Capture button */}
      <button
        onClick={capture}
        disabled={!ready}
        className="mt-8 bg-[#f59e0b] text-black font-black text-xl px-16 py-4 rounded shadow-lg disabled:opacity-40 tracking-widest uppercase"
      >
        CAPTURE
      </button>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genDD = () => {
  let dd = '000';
  for (let i = 0; i < 18; i++) dd += Math.floor(Math.random() * 10).toString();
  return dd;
};

// ─── Main App ─────────────────────────────────────────────────────────────────
const App = () => {
  const canvasRef = useRef(null);
  const backCanvasRef = useRef(null);
  const barcodeCanvasRef = useRef(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backBackgroundImage, setBackBackgroundImage] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [showRef, setShowRef] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchCount, setBatchCount] = useState(1);
  const [isBatching, setIsBatching] = useState(false);
  const abortBatchRef = useRef(false);
  const [activeTab, setActiveTab] = useState('front');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const [info, setInfo] = useState({
    dlNo: '1234567890',
    dob: '1990-01-01',
    lastName: 'DOE',
    firstName: 'JOHN',
    middleName: '',
    suffix: '',
    address1: '123 Main St',
    city: 'ANYTOWN',
    state: 'NV',
    zip: '12345',
    class: 'C',
    end: 'NONE',
    rest: 'NONE',
    iss: '2025-04-14',
    exp: '2033-04-08',
    sex: '1',
    heightFeet: '5',
    heightInches: '9',
    wgt: '180',
    eyes: 'BLU',
    hair: 'BRN',
    dd: genDD(),
    country: 'USA',
    compliance: 'F'
  });

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
  };

  const getDisplayInfo = (data = info) => ({
    ...data,
    dob: formatDateForDisplay(data.dob),
    iss: formatDateForDisplay(data.iss),
    exp: formatDateForDisplay(data.exp),
    address2: `${data.city}, ${data.state} ${data.zip}`.toUpperCase(),
    hgt: `${data.heightFeet}'-${data.heightInches}"`,
    sex: data.sex === '1' ? 'M' : data.sex === '2' ? 'F' : 'X',
    wgt: `${data.wgt} lbs`
  });

  const mapping = {
    dlNo: { x: 47.7, y: 25.3, font: '700 24px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    dob: { x: 44.7, y: 29.0, font: '700 24px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    lastName: { x: 38.1, y: 34.2, font: '700 34px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    firstName: { x: 38.1, y: 39.4, font: '700 34px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    address1: { x: 38.1, y: 44.0, font: '700 24px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    address2: { x: 38.1, y: 47.8, font: '700 24px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    class: { x: 47.4, y: 55.6, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    end: { x: 65.4, y: 55.6, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    rest: { x: 45.2, y: 59.1, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    iss: { x: 36.7, y: 69.1, font: '700 22px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    exp: { x: 57.4, y: 69.1, font: '700 22px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    sex: { x: 45.5, y: 73.9, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    hgt: { x: 45.5, y: 77.6, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    wgt: { x: 45.5, y: 81.5, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    eyes: { x: 45.5, y: 85.2, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    hair: { x: 45.5, y: 89.1, font: '700 21px "Arial Narrow", "Helvetica Condensed", sans-serif' },
    bigDob: { x: 58.7, y: 83.7, font: '700 54px "Helvetica", "Arial", sans-serif', color: 'rgba(15, 15, 15, 0.95)' },
    dd: { x: 43.2, y: 93.8, font: '700 23px "Arial Narrow", "Helvetica Condensed", sans-serif' },
  };

  const startBatch = async () => {
    if (!batchText) return;
    setIsBatching(true);
    abortBatchRef.current = false;

    const lines = batchText.split('\n').filter(l => l.trim().length > 0);
    const limit = Math.min(batchCount, lines.length);

    for (let i = 0; i < limit; i++) {
      if (abortBatchRef.current) break;

      const line = lines[i];
      const parts = line.split(':');
      if (parts.length < 8) continue;

      const [rawFirst, last, address, city, state, zip, ssn, dobRaw] = parts;
      if (!ssn || !dobRaw) continue;

      const firstParts = rawFirst.trim().split(' ');
      const firstName = firstParts[0].toUpperCase();
      const middleName = firstParts.slice(1).join(' ').toUpperCase();
      const lastName = last.trim().toUpperCase();

      let formattedDob = dobRaw.trim();
      const dobParts = formattedDob.split('/');
      if (dobParts.length === 3) {
        const m = dobParts[0].padStart(2, '0');
        const d = dobParts[1].padStart(2, '0');
        const y = dobParts[2];
        if (y.length === 4) formattedDob = `${y}-${m}-${d}`;
      }

      let randomDl = Math.floor(Math.random() * 9 + 1).toString();
      for (let j = 0; j < 9; j++) randomDl += Math.floor(Math.random() * 10).toString();

      const batchInfo = { ...info, firstName, middleName, lastName, dob: formattedDob, dlNo: randomDl };

      drawCanvas(batchInfo);
      generateBarcode(batchInfo);
      drawBackCanvas(batchInfo);

      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;
      const safeDob = formattedDob.replace(/-/g, '');
      const safeSsn = ssn.trim().replace(/-/g, '');

      await new Promise(res => setTimeout(res, 500));

      const linkFront = document.createElement('a');
      linkFront.download = `${initials}_${safeDob}_FRONT.png`;
      linkFront.href = canvasRef.current.toDataURL('image/png', 1.0);
      linkFront.click();

      await new Promise(res => setTimeout(res, 800));

      const linkBack = document.createElement('a');
      linkBack.download = `${initials}_${safeSsn}_BACK.png`;
      linkBack.href = backCanvasRef.current.toDataURL('image/png', 1.0);
      linkBack.click();

      await new Promise(res => setTimeout(res, 1500));
    }

    setIsBatching(false);
  };

  const generateRandomDL = () => {
    let randomDl = '';
    for (let i = 0; i < 10; i++) randomDl += Math.floor(Math.random() * 10).toString();
    setInfo(prev => ({ ...prev, dlNo: randomDl }));
  };

  const generateRandomDD = () => {
    setInfo(prev => ({ ...prev, dd: genDD() }));
  };

  useEffect(() => {
    const front = new Image();
    front.onload = () => setBackgroundImage(front);
    front.src = '/FrontTemplate.jpg';

    const back = new Image();
    back.onload = () => setBackBackgroundImage(back);
    back.src = '/BackTemplate.png';
  }, []);

  useEffect(() => {
    drawCanvas();
    generateBarcode();
    drawBackCanvas();
  }, [info, backgroundImage, backBackgroundImage, photo, signature, referenceImage, showRef, activeTab]);

  const drawBackCanvas = (data = info) => {
    const canvas = backCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const displayInfo = getDisplayInfo(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backBackgroundImage) {
      ctx.drawImage(backBackgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (barcodeCanvasRef.current && barcodeCanvasRef.current.width > 0) {
      const bx = canvas.width * 0.43;
      const by = canvas.height * 0.125;
      const bw = canvas.width * 0.53;
      const bh = canvas.height * 0.275;
      ctx.drawImage(barcodeCanvasRef.current, bx, by, bw, bh);
    }

    const capitalizeFirst = (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';

    ctx.font = '700 20px "Arial", "Helvetica", sans-serif';
    ctx.fillText(displayInfo.dob, canvas.width * 0.113, canvas.height * 0.101);
    ctx.fillText(displayInfo.iss, canvas.width * 0.103, canvas.height * 0.150);

    ctx.font = '700 21px "Arial", "Helvetica", sans-serif';
    ctx.fillText(capitalizeFirst(displayInfo.end), canvas.width * 0.486, canvas.height * 0.688);
    ctx.fillText(capitalizeFirst(displayInfo.rest), canvas.width * 0.461, canvas.height * 0.807);
  };

  const drawCanvas = (data = info) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const displayInfo = getDisplayInfo(data);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (referenceImage && showRef) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(referenceImage, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    const drawImageFit = (img, x, y, w, h, fit = 'cover') => {
      const imgRatio = img.width / img.height;
      const boxRatio = w / h;
      let sx, sy, sw, sh;

      if (fit === 'cover') {
        if (imgRatio > boxRatio) {
          sw = img.height * boxRatio; sh = img.height;
          sx = (img.width - sw) / 2; sy = 0;
        } else {
          sw = img.width; sh = img.width / boxRatio;
          sx = 0; sy = (img.height - sh) / 2;
        }
      } else {
        if (imgRatio > boxRatio) {
          const scale = w / img.width;
          const nh = img.height * scale;
          ctx.drawImage(img, x, y + (h - nh) / 2, w, nh);
          return;
        } else {
          const scale = h / img.height;
          const nw = img.width * scale;
          ctx.drawImage(img, x + (w - nw) / 2, y, nw, h);
          return;
        }
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    };

    if (photo && !showRef) {
      const px = canvas.width * 0.075;
      const py = canvas.height * 0.202;
      const pw = canvas.width * 0.265;
      const ph = canvas.height * 0.565;
      drawImageFit(photo, px, py, pw, ph, 'contain');

      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.filter = 'grayscale(100%) brightness(1.25) contrast(0.85)';
      drawImageFit(photo, canvas.width * 0.835, canvas.height * 0.635, canvas.width * 0.115, canvas.height * 0.215, 'contain');
      ctx.restore();
    }

    if (signature && !showRef) {
      ctx.drawImage(signature, canvas.width * 0.075, canvas.height * 0.816, canvas.width * 0.265, canvas.height * 0.094);
    }

    if (!showRef) {
      ctx.textAlign = 'left';
      Object.keys(mapping).forEach(key => {
        const field = mapping[key];
        ctx.font = field.font;
        ctx.fillStyle = field.color || '#151515';

        let text = displayInfo[key];
        if (key === 'bigDob') {
          const parts = displayInfo.dob.split('/');
          if (parts.length === 3 && parts[2].length === 4) {
            text = `${parts[0]}/${parts[1]}/${parts[2].substring(2)}`;
          } else {
            text = displayInfo.dob;
          }
        }

        if (text) {
          ctx.fillText(text, (field.x / 100) * canvas.width, (field.y / 100) * canvas.height);
        }
      });
    }
  };

  const generateBarcode = (data = info) => {
    if (!barcodeCanvasRef.current) return;

    const formatDateToAAMVA = (dateString) => {
      if (!dateString) return "";
      const [year, month, day] = dateString.split("-");
      return `${month}${day}${year}`;
    };

    const formatHeight = (feet, inches) => {
      const totalInches = (parseInt(feet) || 0) * 12 + (parseInt(inches) || 0);
      return `${totalInches.toString().padStart(3, '0')} in`;
    };

    const formatZip = (zip) => {
      let cleanZip = zip.replace(/[^0-9]/g, '');
      if (cleanZip.length < 9) cleanZip = cleanZip.padEnd(9, '0');
      return cleanZip.substring(0, 9);
    };

    const payloadData = {
      firstName: data.firstName.trim().toUpperCase(),
      middleName: data.middleName.trim().toUpperCase(),
      lastName: data.lastName.trim().toUpperCase(),
      suffix: data.suffix,
      dob: formatDateToAAMVA(data.dob),
      sex: data.sex,
      height: formatHeight(data.heightFeet, data.heightInches),
      eyeColor: data.eyes,
      weight: data.wgt,
      address1: data.address1.trim().toUpperCase(),
      city: data.city.trim().toUpperCase(),
      state: data.state,
      zip: formatZip(data.zip),
      country: data.country,
      dlNumber: data.dlNo.trim().toUpperCase(),
      issueDate: formatDateToAAMVA(data.iss),
      expDate: formatDateToAAMVA(data.exp),
      vehClass: data.class,
      restrictions: data.rest.trim().toUpperCase(),
      endorsements: data.end.trim().toUpperCase(),
      compliance: data.compliance,
      docDiscriminator: data.dd.trim()
    };

    let payload = "DL";
    const mandatoryFields = ["DCA","DCB","DCD","DBA","DCS","DAC","DAD","DBD","DBB","DBC","DAY","DAU","DAG","DAI","DAJ","DAK","DAQ","DCF","DCG","DDE","DDF","DDG"];

    const addField = (id, val) => {
      let finalVal = val;
      if (!finalVal || finalVal === "") {
        if (mandatoryFields.includes(id)) finalVal = "NONE";
        else return;
      }
      payload += `${id}${finalVal}\n`;
    };

    addField("DAQ", payloadData.dlNumber);
    addField("DCS", payloadData.lastName);
    addField("DDE", "N");
    addField("DAC", payloadData.firstName);
    addField("DDF", "N");
    addField("DAD", payloadData.middleName);
    addField("DDG", "N");
    addField("DCU", payloadData.suffix);
    addField("DCA", payloadData.vehClass);
    addField("DCB", payloadData.restrictions);
    addField("DCD", payloadData.endorsements);
    addField("DBD", payloadData.issueDate);
    addField("DBB", payloadData.dob);
    addField("DBA", payloadData.expDate);
    addField("DBC", payloadData.sex);
    addField("DAU", payloadData.height);
    addField("DAY", payloadData.eyeColor);
    addField("DAG", payloadData.address1);
    addField("DAI", payloadData.city);
    addField("DAJ", payloadData.state);
    addField("DAK", payloadData.zip);
    addField("DCF", payloadData.docDiscriminator);
    addField("DCG", payloadData.country);
    if (payloadData.weight) addField("DAW", payloadData.weight.padStart(3, '0'));
    addField("DDA", payloadData.compliance);
    addField("DDB", payloadData.issueDate);

    payload = payload.slice(0, -1) + "\r";
    const iin = "636026";
    const version = "11";
    const jurisVersion = "00";
    const entries = "01";
    const subfileLength = payload.length;
    const lengthStr = subfileLength.toString().padStart(4, '0');
    const offsetStr = "0031";
    const header = `@\n\x1E\rANSI ${iin}${version}${jurisVersion}${entries}DL${offsetStr}${lengthStr}`;
    const finalBarcodeString = header + payload;

    try {
      bwipjs.toCanvas(barcodeCanvasRef.current, {
        bcid: 'pdf417',
        text: finalBarcodeString,
        columns: 9,
        scale: 3,
        eclevel: 5,
        includetext: false,
      });
    } catch (e) {
      console.error('Barcode generation error:', e);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInfo(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handleFileChange = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => setter(img);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdvancedPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const blob = await removeBackground(file, {
        model: 'medium',
        output: { type: 'image/png', quality: 0.8 }
      });
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => { setPhoto(img); setIsProcessingPhoto(false); };
        img.src = event.target.result;
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Background removal failed:", error);
      setIsProcessingPhoto(false);
      handleFileChange(e, setPhoto);
    }
  };

  const handleCameraCapture = useCallback(async (blob) => {
    setIsProcessingPhoto(true);
    try {
      const processedBlob = await removeBackground(blob, {
        model: 'medium',
        output: { type: 'image/png', quality: 0.8 }
      });
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => { setPhoto(img); setIsProcessingPhoto(false); };
        img.src = event.target.result;
      };
      reader.readAsDataURL(processedBlob);
    } catch (error) {
      console.error("Background removal failed:", error);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => { setPhoto(img); setIsProcessingPhoto(false); };
        img.src = event.target.result;
      };
      reader.readAsDataURL(blob);
    }
  }, []);

  const downloadFront = () => {
    const link = document.createElement('a');
    link.download = `NV_ID_FRONT.png`;
    link.href = canvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  const downloadBack = () => {
    const link = document.createElement('a');
    link.download = `NV_ID_BACK.png`;
    link.href = backCanvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <>
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className="min-h-screen bg-[#0f172a] p-3 sm:p-5 lg:p-10 font-sans text-slate-200 selection:bg-blue-500/30">
        <div className="max-w-[1800px] mx-auto">
          <header className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-900/20 shrink-0">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">NV ID STUDIO PRO</h1>
                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.15em] hidden sm:block">AAMVA 2025 COMPLIANT</p>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowRef(!showRef)}
                className={`flex items-center justify-center gap-1.5 px-3 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all shadow-lg active:scale-95 text-sm sm:text-base ${showRef ? 'bg-amber-500 text-white shadow-amber-900/20' : 'bg-[#1e293b] text-slate-300'}`}
              >
                {showRef ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                <span className="hidden sm:inline whitespace-nowrap">{showRef ? 'Hide Reference' : 'Check Alignment'}</span>
              </button>
              <button
                onClick={activeTab === 'front' ? downloadFront : downloadBack}
                className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-blue-900/40 active:scale-95 text-sm sm:text-base"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="whitespace-nowrap">Download {activeTab === 'front' ? 'Front' : 'Back'}</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 lg:gap-10">
            <div className="xl:col-span-4 space-y-4 sm:space-y-6 order-2 xl:order-1">
              <div className="bg-[#1e293b] p-5 lg:p-6 rounded-[32px] shadow-sm border border-slate-800/50">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Upload className="w-3 h-3" /> File Inputs
                </h2>
                <div className="space-y-4">
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Front Active</label>
                      <div className="aspect-[1000/630] rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] relative ring-1 ring-white/5">
                        {backgroundImage ? (
                          <img src={backgroundImage.src} className="w-full h-full object-cover opacity-80" alt="Front Preview" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-600">Loading...</div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Back Active</label>
                      <div className="aspect-[1000/630] rounded-xl overflow-hidden border border-slate-800 bg-[#0f172a] relative ring-1 ring-white/5">
                        {backBackgroundImage ? (
                          <img src={backBackgroundImage.src} className="w-full h-full object-cover opacity-80" alt="Back Preview" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-600">Loading...</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FileComp label="Front Template" onChange={(e) => handleFileChange(e, setBackgroundImage)} />
                    <FileComp label="Back Template" onChange={(e) => handleFileChange(e, setBackBackgroundImage)} />
                  </div>
                  <FileComp label="Ref Image" onChange={(e) => handleFileChange(e, setReferenceImage)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Photo</label>
                      <div className="flex flex-col gap-2">
                        <FileComp label="Regular" onChange={(e) => handleFileChange(e, setPhoto)} />

                        {/* Advanced Face Edit row: file upload + camera button */}
                        <div className="flex gap-2">
                          <button
                            className={`relative flex flex-1 items-center justify-center gap-2 border-2 border-dashed rounded-xl p-2 transition-all ${isProcessingPhoto ? 'bg-blue-900/20 border-blue-500/50' : 'bg-blue-500/5 border-slate-800 hover:bg-blue-500/10 hover:border-blue-500/30'}`}
                            disabled={isProcessingPhoto}
                          >
                            <input
                              type="file"
                              onChange={handleAdvancedPhotoUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                              disabled={isProcessingPhoto}
                            />
                            {isProcessingPhoto ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                <span className="text-[9px] font-black text-blue-400 uppercase">AI Processing...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <ScanFace className="w-3 h-3 text-blue-400" />
                                <span className="text-[9px] font-black text-blue-400 uppercase text-center">Advanced Face Edit</span>
                              </div>
                            )}
                          </button>

                          {/* Camera button */}
                          <button
                            onClick={() => setShowCamera(true)}
                            disabled={isProcessingPhoto}
                            title="Open Camera"
                            className="flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl px-3 py-2 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all disabled:opacity-40"
                          >
                            {isProcessingPhoto ? (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            ) : (
                              <Camera className="w-4 h-4 text-blue-400" />
                            )}
                          </button>
                        </div>

                      </div>
                    </div>
                    <FileComp label="Signature" onChange={(e) => handleFileChange(e, setSignature)} />
                  </div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-[32px] shadow-sm border border-slate-800/50 overflow-hidden">
                <button
                  onClick={() => setBatchOpen(o => !o)}
                  className="w-full flex items-center justify-between px-5 lg:px-6 py-5 text-left"
                >
                  <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Batch Processing
                  </h2>
                  <span className={`text-slate-500 text-lg transition-transform duration-200 ${batchOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {batchOpen && (
                  <div className="px-5 lg:px-6 pb-5 flex flex-col gap-3">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold opacity-60">
                      Format: FIRST:LAST:ADDRESS:CITY:STATE:ZIP:SSN:DOB
                    </p>
                    <textarea
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      placeholder={`CHRISTOPHER:JOHNSON:1841 PRINCETON COURT SW:BIRMINGHAM:AL:35211:423-45-3249:9/1/1995\nNEXT:PERSON:123 STREET...`}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none font-mono h-32 resize-y text-slate-300"
                      disabled={isBatching}
                    />
                    <div className="flex gap-3 items-end mt-1">
                      <div className="flex flex-col flex-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1 mb-1"># of Lines</label>
                        <input
                          type="number"
                          min="1"
                          value={batchCount}
                          onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                          className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-[14px] focus:ring-4 focus:ring-blue-500/20 outline-none font-black text-white"
                          disabled={isBatching}
                        />
                      </div>
                      {!isBatching ? (
                        <button onClick={startBatch} className="bg-green-600 hover:bg-green-500 text-white font-black px-6 py-3 rounded-xl transition-colors shadow-lg shadow-green-900/20">
                          Start Batch
                        </button>
                      ) : (
                        <button onClick={() => abortBatchRef.current = true} className="bg-red-600 hover:bg-red-500 text-white font-black px-6 py-3 rounded-xl transition-colors shadow-lg shadow-red-900/20 animate-pulse">
                          Stop Batch
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#1e293b] p-5 lg:p-6 rounded-[32px] shadow-sm border border-slate-800/50">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Identity Data</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <DataGroup label="DL Number" name="dlNo" value={info.dlNo} onChange={handleInputChange} action={{ label: 'GEN', onClick: generateRandomDL }} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">DOB</label>
                    <input type="date" name="dob" value={info.dob} onChange={handleInputChange} className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-[14px] focus:ring-4 focus:ring-blue-500/20 focus:bg-[#1e293b] outline-none transition-all font-black text-white appearance-none" />
                  </div>
                  <DataGroup label="First Name" name="firstName" value={info.firstName} onChange={handleInputChange} />
                  <DataGroup label="Last Name" name="lastName" value={info.lastName} onChange={handleInputChange} />
                  <DataGroup label="Middle Name" name="middleName" value={info.middleName} onChange={handleInputChange} />
                  <DataGroup label="Suffix" name="suffix" value={info.suffix} onChange={handleInputChange} />
                  <DataGroup label="Street Address" name="address1" value={info.address1} onChange={handleInputChange} className="col-span-2" />
                  <DataGroup label="City" name="city" value={info.city} onChange={handleInputChange} />
                  <DataGroup label="State" name="state" value={info.state} onChange={handleInputChange} />
                  <DataGroup label="Zip" name="zip" value={info.zip} onChange={handleInputChange} className="col-span-2" />

                  <div className="col-span-2 grid grid-cols-3 gap-3">
                    <DataGroup label="Class" name="class" value={info.class} onChange={handleInputChange} />
                    <DataGroup label="End" name="end" value={info.end} onChange={handleInputChange} />
                    <DataGroup label="Rest" name="rest" value={info.rest} onChange={handleInputChange} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">ISS Date</label>
                    <input type="date" name="iss" value={info.iss} onChange={handleInputChange} className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-[14px] focus:ring-4 focus:ring-blue-500/20 focus:bg-[#1e293b] outline-none transition-all font-black text-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">EXP Date</label>
                    <input type="date" name="exp" value={info.exp} onChange={handleInputChange} className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-[14px] focus:ring-4 focus:ring-blue-500/20 focus:bg-[#1e293b] outline-none transition-all font-black text-white" />
                  </div>

                  <div className="col-span-2 grid grid-cols-5 gap-1.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Sex</label>
                      <select name="sex" value={info.sex} onChange={handleInputChange} className="bg-[#0f172a] border border-slate-800 rounded-xl px-2 py-3 text-[14px] font-black text-white outline-none">
                        <option value="1">M</option>
                        <option value="2">F</option>
                        <option value="9">X</option>
                      </select>
                    </div>
                    <DataGroup label="Ft" name="heightFeet" value={info.heightFeet} onChange={handleInputChange} />
                    <DataGroup label="In" name="heightInches" value={info.heightInches} onChange={handleInputChange} />
                    <DataGroup label="Wt" name="wgt" value={info.wgt} onChange={handleInputChange} />
                    <DataGroup label="Ey" name="eyes" value={info.eyes} onChange={handleInputChange} />
                  </div>

                  <DataGroup label="Audit Code (DD)" name="dd" value={info.dd} onChange={handleInputChange} className="col-span-2" action={{ label: 'GEN', onClick: generateRandomDD }} />
                  <DataGroup label="Compliance" name="compliance" value={info.compliance} onChange={handleInputChange} />
                  <DataGroup label="Country" name="country" value={info.country} onChange={handleInputChange} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-8 order-1 xl:order-2">
              <div className="sticky top-6 lg:top-10">
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => setActiveTab('front')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black transition-all ${activeTab === 'front' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#1e293b] text-slate-400 hover:bg-[#334155]'}`}
                  >
                    <UserCircle className="w-5 h-5" /> Front ID
                  </button>
                  <button
                    onClick={() => setActiveTab('back')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black transition-all ${activeTab === 'back' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-[#1e293b] text-slate-400 hover:bg-[#334155]'}`}
                  >
                    <Barcode className="w-5 h-5" /> Back Barcode
                  </button>
                </div>

                <div className="bg-[#1e293b] p-3 lg:p-4 rounded-[32px] lg:rounded-[40px] shadow-2xl border border-slate-800">
                  <div className="relative aspect-[1000/630] bg-[#0f172a] rounded-2xl overflow-hidden flex items-center justify-center ring-1 ring-white/5">
                    <canvas
                      ref={canvasRef}
                      width={1000}
                      height={630}
                      className={`w-full h-full object-contain cursor-crosshair bg-[#ffffff] ${activeTab === 'front' ? 'block' : 'hidden'}`}
                    />
                    <canvas
                      ref={backCanvasRef}
                      width={1000}
                      height={630}
                      className={`w-full h-full object-contain cursor-crosshair ${activeTab === 'back' ? 'block' : 'hidden'}`}
                    />
                    <canvas ref={barcodeCanvasRef} style={{ display: 'none' }} />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 md:flex md:justify-center gap-3 lg:gap-6">
                  <Legend label="Baseline Fix" />
                  <Legend label="Condensed Weight" />
                  <Legend label="Nudged X-Offset" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const DataGroup = ({ label, name, value, onChange, className = "", action }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    <div className="flex">
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-[14px] focus:ring-4 focus:ring-blue-500/20 focus:bg-[#1e293b] outline-none transition-all font-black text-white"
      />
      {action && (
        <button type="button" onClick={action.onClick} className="ml-2 bg-[#334155] hover:bg-[#475569] text-slate-200 text-[10px] font-black px-3 rounded-xl transition-colors shrink-0">
          {action.label}
        </button>
      )}
    </div>
  </div>
);

const FileComp = ({ label, onChange }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    <div className="relative border border-slate-800 rounded-xl p-2 bg-[#0f172a] hover:bg-[#1e293b] transition-colors group">
      <input type="file" onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
      <div className="text-[10px] font-bold text-slate-400 text-center py-1 uppercase group-hover:text-slate-200">Upload {label}</div>
    </div>
  </div>
);

const Legend = ({ label }) => (
  <div className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] rounded-full border border-slate-800 shadow-sm">
    <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{label}</span>
  </div>
);

export default App;
