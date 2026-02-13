import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dtiAPI } from '../services/api';
import Navbar from '../components/Navbar';

const DTIPriceManagement = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('records'); // records, upload, manual, bulk

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    product_name: '', price_low: '', price_high: '', unit: 'kg'
  });

  // Bulk entry
  const [bulkRows, setBulkRows] = useState([
    { product_name: '', price_low: '', price_high: '', unit: 'kg' }
  ]);

  // PDF upload
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selection for bulk delete
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const units = ['kg', 'g', 'piece', 'pack', 'bunch', 'bundle', 'box', 'tray', 'liter', 'ml', 'lb', 'can', 'bottle'];

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dtiAPI.getPrices();
      setRecords(res.data?.records || []);
    } catch (error) {
      console.error('Failed to load DTI records:', error);
      setFlashMessages([{ category: 'error', text: 'Failed to load DTI price records.' }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.is_admin) {
      loadRecords();
    }
  }, [user, loadRecords]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      await dtiAPI.manualEntry({
        product_name: manualForm.product_name,
        price_low: parseFloat(manualForm.price_low),
        price_high: parseFloat(manualForm.price_high) || parseFloat(manualForm.price_low),
        unit: manualForm.unit
      });
      setFlashMessages([{ category: 'success', text: 'Price record added successfully!' }]);
      setManualForm({ product_name: '', price_low: '', price_high: '', unit: 'kg' });
      loadRecords();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: error.response?.data?.error || 'Failed to add price record.' }]);
    }
  };

  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (!pdfFile) {
      setFlashMessages([{ category: 'error', text: 'Please select a PDF file.' }]);
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      const res = await dtiAPI.uploadPdf(formData);
      setUploadResult(res.data);
      setFlashMessages([{ category: 'success', text: res.data.message || 'PDF processed successfully!' }]);
      setPdfFile(null);
      // Reset file input
      const fileInput = document.getElementById('dti-pdf-input');
      if (fileInput) fileInput.value = '';
      loadRecords();
    } catch (error) {
      const errData = error.response?.data;
      setFlashMessages([{ category: 'error', text: errData?.error || 'Failed to process PDF.' }]);
      if (errData?.raw_text_preview) {
        setUploadResult({ raw_text_preview: errData.raw_text_preview, error: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const validRows = bulkRows.filter(r => r.product_name && r.price_low);
    if (validRows.length === 0) {
      setFlashMessages([{ category: 'error', text: 'Please fill in at least one row.' }]);
      return;
    }
    try {
      const records = validRows.map(r => ({
        product_name: r.product_name,
        price_low: parseFloat(r.price_low),
        price_high: parseFloat(r.price_high) || parseFloat(r.price_low),
        unit: r.unit
      }));
      const res = await dtiAPI.bulkEntry(records);
      setFlashMessages([{ category: 'success', text: res.data.message }]);
      setBulkRows([{ product_name: '', price_low: '', price_high: '', unit: 'kg' }]);
      loadRecords();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: error.response?.data?.error || 'Failed to add records.' }]);
    }
  };

  const addBulkRow = () => {
    setBulkRows([...bulkRows, { product_name: '', price_low: '', price_high: '', unit: 'kg' }]);
  };

  const removeBulkRow = (index) => {
    setBulkRows(bulkRows.filter((_, i) => i !== index));
  };

  const updateBulkRow = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  const deleteRecord = async (recordId, productName) => {
    if (!window.confirm(`Delete price record for "${productName}"?`)) return;
    try {
      await dtiAPI.deleteRecord(recordId);
      setFlashMessages([{ category: 'success', text: 'Record deleted.' }]);
      setSelectedIds(prev => { const next = new Set(prev); next.delete(recordId); return next; });
      loadRecords();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to delete record.' }]);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredRecords.map(r => r._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id, checked) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const allSelected = selectedIds.size === filteredRecords.length && filteredRecords.length === records.length;
    const msg = allSelected
      ? `Delete ALL ${records.length} DTI price records?`
      : `Delete ${selectedIds.size} selected record(s)?`;
    if (!window.confirm(msg)) return;
    try {
      setLoading(true);
      if (allSelected) {
        await dtiAPI.bulkDelete([], true);
      } else {
        await dtiAPI.bulkDelete([...selectedIds]);
      }
      setFlashMessages([{ category: 'success', text: `${selectedIds.size} record(s) deleted.` }]);
      setSelectedIds(new Set());
      setBulkDeleteMode(false);
      loadRecords();
    } catch (error) {
      setFlashMessages([{ category: 'error', text: error.response?.data?.error || 'Failed to delete records.' }]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(rec =>
    !searchQuery || rec.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group records by batch
  const batches = {};
  filteredRecords.forEach(rec => {
    const key = rec.batch_id || 'unknown';
    if (!batches[key]) {
      batches[key] = {
        batch_id: key,
        source: rec.source_file,
        date: rec.uploaded_at,
        records: []
      };
    }
    batches[key].records.push(rec);
  });

  if (!user || !user.is_admin) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>This page is only available for administrators.</p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="manage-products-page">
      {/* Navigation */}
      <Navbar />

      <section className="products-page">
        <div className="container">
          {/* Flash Messages */}
          {flashMessages.length > 0 && (
            <div className="flash-messages" style={{ marginBottom: '20px' }}>
              {flashMessages.map((msg, i) => (
                <div key={i} className={`alert alert-${msg.category}`}
                  style={{
                    padding: '12px 16px', borderRadius: '8px', marginBottom: '8px',
                    background: msg.category === 'success' ? '#d4edda' : '#f8d7da',
                    color: msg.category === 'success' ? '#155724' : '#721c24',
                    border: `1px solid ${msg.category === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                  }}>
                  {msg.text}
                  <button onClick={() => setFlashMessages(flashMessages.filter((_, idx) => idx !== i))}
                    style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #e9ecef' }}>
            {[
              { key: 'records', icon: 'fas fa-list', label: 'Price Records' },
              { key: 'upload', icon: 'fas fa-file-pdf', label: 'Upload PDF' },
              { key: 'manual', icon: 'fas fa-keyboard', label: 'Manual Entry' },
              { key: 'bulk', icon: 'fas fa-table', label: 'Bulk Entry' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '12px 24px', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.key ? '#4CAF50' : 'transparent',
                  color: activeTab === tab.key ? '#fff' : '#666',
                  fontWeight: activeTab === tab.key ? '600' : '400',
                  borderRadius: '8px 8px 0 0', fontSize: '0.95rem',
                  transition: 'all 0.2s',
                }}>
                <i className={tab.icon} style={{ marginRight: '8px' }}></i>{tab.label}
              </button>
            ))}
          </div>

          {/* TAB: Price Records */}
          {activeTab === 'records' && (
            <div className="profile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>
                  <i className="fas fa-database"></i> DTI Price Records ({filteredRecords.length})
                </h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {bulkDeleteMode ? (
                    <>
                      <button onClick={handleBulkDelete}
                        className="btn btn-danger" disabled={selectedIds.size === 0}
                        style={{ fontSize: '0.85rem', padding: '8px 16px', opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                        <i className="fas fa-trash"></i> Delete Selected ({selectedIds.size})
                      </button>
                      <button onClick={() => { setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                        className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setBulkDeleteMode(true)}
                      className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '8px 16px', color: '#dc3545', borderColor: '#dc3545' }}>
                      <i className="fas fa-trash-alt"></i> Bulk Delete
                    </button>
                  )}
                  <input
                    type="text" placeholder="Search products..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '6px', width: '250px' }}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#4CAF50' }}></i>
                  <p>Loading records...</p>
                </div>
              ) : filteredRecords.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        {bulkDeleteMode && (
                          <th style={thStyle}>
                            <input type="checkbox"
                              checked={filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r._id))}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                              title="Select all"
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </th>
                        )}
                        <th style={thStyle}>Product Name</th>
                        <th style={thStyle}>Price Low</th>
                        <th style={thStyle}>Price High</th>
                        <th style={thStyle}>Average</th>
                        <th style={thStyle}>Unit</th>
                        <th style={thStyle}>Source</th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((rec, i) => (
                        <tr key={rec._id || i} style={{
                          borderBottom: '1px solid #eee',
                          background: bulkDeleteMode && selectedIds.has(rec._id) ? '#e8f5e9' : 'transparent'
                        }}>
                          {bulkDeleteMode && (
                            <td style={tdStyle}>
                              <input type="checkbox"
                                checked={selectedIds.has(rec._id)}
                                onChange={(e) => handleSelectOne(rec._id, e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={tdStyle}><strong>{rec.product_name}</strong></td>
                          <td style={tdStyle}>₱{rec.price_low?.toFixed(2)}</td>
                          <td style={tdStyle}>₱{rec.price_high?.toFixed(2)}</td>
                          <td style={tdStyle}>₱{rec.average_price?.toFixed(2)}</td>
                          <td style={tdStyle}>{rec.unit}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: '0.8rem', color: '#888' }}>
                              {rec.source_file === 'manual_entry' ? '✏️ Manual' : rec.source_file === 'bulk_manual_entry' ? '📋 Bulk' : `📄 ${rec.source_file?.substring(0, 20)}...`}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: '0.8rem', color: '#888' }}>
                              {rec.uploaded_at ? new Date(rec.uploaded_at).toLocaleDateString() : '-'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <button onClick={() => deleteRecord(rec._id, rec.product_name)}
                              className="btn btn-danger btn-small" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <i className="fas fa-inbox" style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.5 }}></i>
                  <p>No DTI price records yet.</p>
                  <p style={{ fontSize: '0.9rem' }}>Upload a DTI PDF or add prices manually to get started.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: Upload PDF */}
          {activeTab === 'upload' && (
            <div className="profile-card">
              <h2><i className="fas fa-file-upload"></i> Upload DTI Price Bulletin PDF</h2>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Upload a DTI price monitoring bulletin in PDF format. The system will automatically extract product names and prices.
              </p>

              <form onSubmit={handlePdfUpload}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="dti-pdf-input" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    Select PDF File
                  </label>
                  <input
                    type="file" id="dti-pdf-input" accept=".pdf"
                    onChange={(e) => { setPdfFile(e.target.files[0]); setUploadResult(null); }}
                    style={{ display: 'block', padding: '10px', border: '2px dashed #ccc', borderRadius: '8px', width: '100%', cursor: 'pointer' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading || !pdfFile}>
                  {loading ? <><i className="fas fa-spinner fa-spin"></i> Processing...</> : <><i className="fas fa-upload"></i> Upload & Parse PDF</>}
                </button>
              </form>

              {uploadResult && (
                <div style={{ marginTop: '24px', padding: '16px', background: uploadResult.error ? '#fff3cd' : '#d4edda', borderRadius: '8px' }}>
                  {uploadResult.error ? (
                    <>
                      <h4 style={{ color: '#856404' }}>Could not extract prices automatically</h4>
                      <p style={{ fontSize: '0.9rem' }}>The PDF text was extracted but the format wasn't recognized. You can add the prices manually instead.</p>
                      {uploadResult.raw_text_preview && (
                        <details style={{ marginTop: '12px' }}>
                          <summary style={{ cursor: 'pointer', color: '#856404' }}>View extracted text</summary>
                          <pre style={{ fontSize: '0.75rem', maxHeight: '300px', overflow: 'auto', background: '#fff', padding: '12px', borderRadius: '4px', marginTop: '8px' }}>
                            {uploadResult.raw_text_preview}
                          </pre>
                        </details>
                      )}
                    </>
                  ) : (
                    <>
                      <h4 style={{ color: '#155724' }}><i className="fas fa-check-circle"></i> {uploadResult.message}</h4>
                      {uploadResult.records && (
                        <div style={{ marginTop: '12px', maxHeight: '300px', overflow: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: 'rgba(0,0,0,0.05)' }}>
                                <th style={thStyle}>Product</th>
                                <th style={thStyle}>Low</th>
                                <th style={thStyle}>High</th>
                                <th style={thStyle}>Avg</th>
                                <th style={thStyle}>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uploadResult.records.map((rec, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={tdStyle}>{rec.product_name}</td>
                                  <td style={tdStyle}>₱{rec.price_low?.toFixed(2)}</td>
                                  <td style={tdStyle}>₱{rec.price_high?.toFixed(2)}</td>
                                  <td style={tdStyle}>₱{rec.average_price?.toFixed(2)}</td>
                                  <td style={tdStyle}>{rec.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Manual Entry */}
          {activeTab === 'manual' && (
            <div className="profile-card">
              <h2><i className="fas fa-keyboard"></i> Manual Price Entry</h2>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Manually add a DTI SRP record for a product.
              </p>

              <form onSubmit={handleManualSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" placeholder="e.g., Tomato, Well-milled Rice"
                      value={manualForm.product_name}
                      onChange={(e) => setManualForm({ ...manualForm, product_name: e.target.value })}
                      required />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <select value={manualForm.unit} onChange={(e) => setManualForm({ ...manualForm, unit: e.target.value })}>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>DTI Price Low (₱)</label>
                    <input type="number" step="0.01" min="0.01" placeholder="e.g., 50.00"
                      value={manualForm.price_low}
                      onChange={(e) => setManualForm({ ...manualForm, price_low: e.target.value })}
                      required />
                  </div>
                  <div className="form-group">
                    <label>DTI Price High (₱)</label>
                    <input type="number" step="0.01" min="0.01" placeholder="e.g., 65.00"
                      value={manualForm.price_high}
                      onChange={(e) => setManualForm({ ...manualForm, price_high: e.target.value })} />
                    <small style={{ color: '#888' }}>Leave empty to use same as low price</small>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
                  <i className="fas fa-plus"></i> Add Price Record
                </button>
              </form>
            </div>
          )}

          {/* TAB: Bulk Entry */}
          {activeTab === 'bulk' && (
            <div className="profile-card">
              <h2><i className="fas fa-table"></i> Bulk Price Entry</h2>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Add multiple DTI price records at once.
              </p>

              <form onSubmit={handleBulkSubmit}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={thStyle}>Product Name</th>
                        <th style={thStyle}>Price Low (₱)</th>
                        <th style={thStyle}>Price High (₱)</th>
                        <th style={thStyle}>Unit</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row, i) => (
                        <tr key={i}>
                          <td style={tdStyle}>
                            <input type="text" placeholder="Product name" value={row.product_name}
                              onChange={(e) => updateBulkRow(i, 'product_name', e.target.value)}
                              style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                          </td>
                          <td style={tdStyle}>
                            <input type="number" step="0.01" min="0" placeholder="0.00" value={row.price_low}
                              onChange={(e) => updateBulkRow(i, 'price_low', e.target.value)}
                              style={{ width: '100px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                          </td>
                          <td style={tdStyle}>
                            <input type="number" step="0.01" min="0" placeholder="0.00" value={row.price_high}
                              onChange={(e) => updateBulkRow(i, 'price_high', e.target.value)}
                              style={{ width: '100px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }} />
                          </td>
                          <td style={tdStyle}>
                            <select value={row.unit} onChange={(e) => updateBulkRow(i, 'unit', e.target.value)}
                              style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                              {units.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            {bulkRows.length > 1 && (
                              <button type="button" onClick={() => removeBulkRow(i)}
                                style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>
                                <i className="fas fa-minus"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-outline" onClick={addBulkRow}>
                    <i className="fas fa-plus"></i> Add Row
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="fas fa-save"></i> Save All Records
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3><i className="fas fa-seedling"></i> FarmtoClick</h3>
              <p>Connecting communities with fresh, local produce since 2024.</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 FarmtoClick. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '0.85rem', color: '#555' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' };

export default DTIPriceManagement;
