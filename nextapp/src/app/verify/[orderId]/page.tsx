'use client';
import { useState, useEffect, useRef, use } from 'react';
import { loadDB, saveDB } from '@/lib/store';
import { fmtCurrency } from '@/lib/fmt';

export default function VerifyPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<ReturnType<typeof loadDB>['orders'][0] | undefined>();
  const [settings, setSettings] = useState<ReturnType<typeof loadDB>['settings'] | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const db = loadDB();
    const o = db.orders.find(x => x.id === orderId);
    setOrder(o);
    setSettings(db.settings);
    if (o?.restaurantStatus === 'verified') {
      setConfirmed(true);
      setPin(o.verificationPin || '');
    }
  }, [orderId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setError('Microphone access denied. You can still confirm by tapping the button below.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  if (!order || !settings) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontSize: 18 }}>Order not found</div>
          <div style={{ color: '#8b95a3', fontSize: 14, marginTop: 8 }}>This link may have expired or is invalid.</div>
        </div>
      </div>
    );
  }

  if (order.status === 'void') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 18 }}>Order Cancelled</div>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    if (order.pinExpiry && Date.now() > order.pinExpiry) {
      setError('This confirmation link has expired. Please ask the waiter to resend.');
      return;
    }
    const db = loadDB();
    const o = db.orders.find(x => x.id === orderId);
    if (o) {
      o.restaurantStatus = 'verified';
      saveDB(db);
      setConfirmed(true);
      setPin(o.verificationPin || '');
      const key = 'harbinger_pos';
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(db), storageArea: localStorage }));
    }
  };

  const currency = settings.currency;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e8ecf1', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#181c25', borderBottom: '1px solid #2a3040', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#4f8ef7' }}>⚡</div>
        <div>
          <div style={{ fontWeight: 700 }}>{settings.business}</div>
          {order.tableName && <div style={{ fontSize: 12, color: '#8b95a3' }}>{order.tableName}</div>}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8b95a3' }}>#{order.no}</div>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
        {!confirmed ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px 0' }}>Review Your Order</h2>
            <p style={{ color: '#8b95a3', fontSize: 14, margin: '0 0 24px 0' }}>
              Please check your order below and confirm when ready.
            </p>

            {/* Order items */}
            <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              {order.lines.map((line, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', borderBottom: i < order.lines.length - 1 ? '1px solid #2a3040' : 'none',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{line.name}</div>
                    <div style={{ fontSize: 13, color: '#8b95a3' }}>{fmtCurrency(line.price, currency)} each</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{fmtCurrency(line.price * line.qty, currency)}</div>
                    <div style={{ fontSize: 13, color: '#8b95a3' }}>×{line.qty}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, color: '#8b95a3' }}>
                <span>Subtotal</span><span>{fmtCurrency(order.subtotal, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, color: '#8b95a3' }}>
                <span>{settings.taxLabel} ({settings.taxRate}%)</span><span>{fmtCurrency(order.tax, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20, paddingTop: 10, borderTop: '1px solid #2a3040' }}>
                <span>Total</span>
                <span style={{ color: '#4f8ef7' }}>{fmtCurrency(order.total, currency)}</span>
              </div>
            </div>

            {/* Optional voice recording */}
            <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Optional: Voice Confirmation</div>
              <div style={{ fontSize: 12, color: '#8b95a3', marginBottom: 12 }}>
                Say &quot;Yes, I confirm&quot; to record your verbal agreement (optional, does not block confirmation).
              </div>
              {audioUrl ? (
                <div>
                  <audio controls src={audioUrl} style={{ width: '100%', height: 36, marginBottom: 8 }} />
                  <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} style={{
                    background: 'none', border: '1px solid #2a3040', color: '#8b95a3', borderRadius: 8,
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                  }}>Record again</button>
                </div>
              ) : recording ? (
                <button onClick={stopRecording} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 10,
                  color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 600, width: '100%', justifyContent: 'center',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                  Recording… Tap to stop
                </button>
              ) : (
                <button onClick={startRecording} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                  background: 'rgba(79,142,247,0.1)', border: '1px solid #4f8ef7', borderRadius: 10,
                  color: '#4f8ef7', cursor: 'pointer', fontSize: 14, fontWeight: 600, width: '100%', justifyContent: 'center',
                }}>
                  🎙️ Record &quot;Yes, I confirm&quot;
                </button>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button onClick={handleConfirm} style={{
              width: '100%', padding: '18px', background: '#4f8ef7', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer',
              letterSpacing: 0.3,
            }}>
              ✓ Confirm My Order
            </button>

            <p style={{ textAlign: 'center', color: '#8b95a3', fontSize: 13, marginTop: 14 }}>
              By confirming you agree to pay the total above. Nothing will be cooked until you confirm.
            </p>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>Order Confirmed!</h2>
            <p style={{ color: '#8b95a3', fontSize: 15, margin: '0 0 32px 0' }}>
              Show this PIN to your waiter to send the order to the kitchen:
            </p>

            <div style={{ background: '#181c25', border: '2px solid #4f8ef7', borderRadius: 16, padding: '32px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#8b95a3', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your One-Time PIN</div>
              <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: 16, color: '#4f8ef7', fontVariantNumeric: 'tabular-nums' }}>
                {pin}
              </div>
            </div>

            <p style={{ color: '#8b95a3', fontSize: 14, lineHeight: 1.5 }}>
              Tell this PIN to your waiter.<br />
              Your order will start cooking right away.
            </p>

            <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🍽️</span>
              <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 600 }}>Order being prepared for {order.tableName || 'your table'}</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
