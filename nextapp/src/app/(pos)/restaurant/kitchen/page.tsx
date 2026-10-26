'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Kitchen } from '@/lib/types';
import { uid } from '@/lib/fmt';

const COLORS = ['#4f8ef7', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

function KitchenModal({ kitchen, onClose, onSave }: {
  kitchen?: Kitchen;
  onClose: () => void;
  onSave: (k: Kitchen) => void;
}) {
  const [name, setName] = useState(kitchen?.name || '');
  const [color, setColor] = useState(kitchen?.color || COLORS[0]);
  const [printerIp, setPrinterIp] = useState(kitchen?.printerIp || '');
  const [printerPort, setPrinterPort] = useState(kitchen?.printerPort || 9100);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 400 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>{kitchen ? 'Edit Kitchen' : 'Add Kitchen'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Kitchen Name *</label>
            <input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Italian, Indian, Juice Corner" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: color === c ? '3px solid #fff' : '2px solid transparent', cursor: 'pointer',
                }} />
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Network Printer (KOT)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Printer IP Address</label>
                <input className="inp" value={printerIp} onChange={e => setPrinterIp(e.target.value)} placeholder="192.168.1.100" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Port</label>
                <input className="inp" type="number" value={printerPort} onChange={e => setPrinterPort(+e.target.value)} style={{ width: 80 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                if (!name.trim()) return;
                onSave({
                  id: kitchen?.id || uid(),
                  name: name.trim(), color,
                  categories: kitchen?.categories || [],
                  printerIp: printerIp.trim() || undefined,
                  printerPort,
                  active: kitchen?.active ?? true,
                });
              }}>Save</button>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KitchenAdminPage() {
  const { db, save, settings } = usePOS();
  const [tab, setTab] = useState<'kitchens' | 'categories' | 'products'>('kitchens');
  const [editKitchen, setEditKitchen] = useState<Kitchen | null | 'new'>(null);

  // All unique product categories
  const allCategories = Array.from(new Set(db.products.map(p => p.category || 'Uncategorised').filter(Boolean))).sort();

  const handleSaveKitchen = (k: Kitchen) => {
    save(d => {
      const i = d.kitchens.findIndex(x => x.id === k.id);
      if (i >= 0) d.kitchens[i] = k;
      else d.kitchens.push(k);
    });
    setEditKitchen(null);
  };

  const handleToggleActive = (id: string) => {
    save(d => {
      const k = d.kitchens.find(x => x.id === id);
      if (k) k.active = !k.active;
    });
  };

  const handleDeleteKitchen = (id: string) => {
    if (!confirm('Delete this kitchen?')) return;
    save(d => { d.kitchens = d.kitchens.filter(k => k.id !== id); });
  };

  const handleCategoryAssign = (category: string, kitchenId: string) => {
    save(d => {
      // Remove category from all kitchens, then add to selected
      d.kitchens.forEach(k => { k.categories = k.categories.filter(c => c !== category); });
      if (kitchenId) {
        const k = d.kitchens.find(x => x.id === kitchenId);
        if (k) k.categories.push(category);
      }
    });
  };

  const getCategoryKitchen = (category: string) =>
    db.kitchens.find(k => k.categories.includes(category));

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Kitchen Setup</h1>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Configure kitchen sections and KOT printer routing</div>
        </div>
        {tab === 'kitchens' && (
          <button className="btn btn-primary" onClick={() => setEditKitchen('new')}>+ Add Kitchen</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {([['kitchens', 'Kitchens'], ['categories', 'Category → Printer'], ['products', 'Product → Kitchen']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            color: tab === key ? 'var(--text)' : 'var(--text2)',
            fontWeight: tab === key ? 600 : 400, fontSize: 14,
            borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Kitchens Tab */}
      {tab === 'kitchens' && (
        <div>
          {db.kitchens.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>No kitchens yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create kitchen sections like "Italian", "Indian", "Juice Corner"</div>
              <button className="btn btn-primary" onClick={() => setEditKitchen('new')}>+ Add Kitchen</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {db.kitchens.map(k => (
                <div key={k.id} className="card" style={{ borderLeft: `4px solid ${k.color}`, opacity: k.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{k.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                        {k.categories.length} categories assigned
                      </div>
                    </div>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: k.active ? 'rgba(34,197,94,0.15)' : 'var(--bg3)', color: k.active ? 'var(--green)' : 'var(--text2)' }}>
                      {k.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Printer info */}
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
                    {k.printerIp ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🖨️</span>
                        <span>{k.printerIp}:{k.printerPort || 9100}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text2)', fontStyle: 'italic' }}>No printer configured</span>
                    )}
                  </div>

                  {/* Categories */}
                  {k.categories.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {k.categories.map(c => (
                        <span key={c} style={{ background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, padding: '3px 8px', borderRadius: 12 }}>{c}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => setEditKitchen(k)}>Edit</button>
                    <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                      onClick={() => handleToggleActive(k.id)}>
                      {k.active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-danger" style={{ justifyContent: 'center', fontSize: 12, padding: '6px 10px' }}
                      onClick={() => handleDeleteKitchen(k.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Assignment Tab */}
      {tab === 'categories' && (
        <div>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
            Assign each product category to a kitchen section. Items will be automatically routed to the correct kitchen when an order is confirmed.
          </div>

          {db.kitchens.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
              Create kitchen sections first in the Kitchens tab.
            </div>
          ) : allCategories.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
              No product categories found. Add categories to your products first.
            </div>
          ) : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Product Category</th>
                  <th>Assigned Kitchen / Printer</th>
                  <th>KOT Driver</th>
                </tr>
              </thead>
              <tbody>
                {allCategories.map(cat => {
                  const assignedKitchen = getCategoryKitchen(cat);
                  return (
                    <tr key={cat}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {assignedKitchen && (
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: assignedKitchen.color, display: 'inline-block', flexShrink: 0 }} />
                          )}
                          {cat}
                        </div>
                      </td>
                      <td>
                        <select
                          className="inp"
                          style={{ padding: '6px 10px', fontSize: 13, minWidth: 160 }}
                          value={assignedKitchen?.id || ''}
                          onChange={e => handleCategoryAssign(cat, e.target.value)}
                        >
                          <option value="">— Unassigned —</option>
                          {db.kitchens.filter(k => k.active).map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>
                        {assignedKitchen?.printerIp ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🖨️</span>
                            {assignedKitchen.printerIp}:{assignedKitchen.printerPort || 9100}
                          </span>
                        ) : (
                          <span style={{ fontStyle: 'italic' }}>Screen only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Product Assignment Tab */}
      {tab === 'products' && (
        <div>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
            Override the kitchen for specific products. This takes priority over category routing.
          </div>
          {db.kitchens.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
              Create kitchen sections first in the Kitchens tab.
            </div>
          ) : db.products.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>
              No products found. Add products first.
            </div>
          ) : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Kitchen Override</th>
                </tr>
              </thead>
              <tbody>
                {db.products.filter(p => p.active).map(prod => {
                  const assignedKitchen = prod.kitchenId ? db.kitchens.find(k => k.id === prod.kitchenId) : undefined;
                  const categoryKitchen = prod.category ? db.kitchens.find(k => k.categories.includes(prod.category!)) : undefined;
                  return (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: 600 }}>{prod.name}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                        {prod.category || '—'}
                        {categoryKitchen && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: categoryKitchen.color }}>→ {categoryKitchen.name}</span>
                        )}
                      </td>
                      <td>
                        <select
                          className="inp"
                          style={{ padding: '6px 10px', fontSize: 13, minWidth: 160 }}
                          value={assignedKitchen?.id || ''}
                          onChange={e => {
                            const kitchenId = e.target.value || undefined;
                            save(d => {
                              const p = d.products.find(x => x.id === prod.id);
                              if (p) p.kitchenId = kitchenId;
                            });
                          }}
                        >
                          <option value="">— Use category routing —</option>
                          {db.kitchens.filter(k => k.active).map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {editKitchen && (
        <KitchenModal
          kitchen={editKitchen === 'new' ? undefined : editKitchen}
          onClose={() => setEditKitchen(null)}
          onSave={handleSaveKitchen}
        />
      )}
    </div>
  );
}
