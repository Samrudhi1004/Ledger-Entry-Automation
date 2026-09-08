import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FileText, 
  Upload, 
  History, 
  Plus, 
  Search, 
  Download, 
  FileCode, 
  Trash2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  ShieldAlert
} from 'lucide-react';
import { getDrawings, createDrawing, uploadDrawingVersion, getDrawingHistory, deleteDrawing, getParts } from '../api/parts';
import { useAuth } from '../context/AuthContext';

export default function DrawingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [drawings, setDrawings] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload New Drawing Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newDrawingForm, setNewDrawingForm] = useState({
    part: '',
    drawing_number: '',
    title: '',
    description: '',
    revision_code: 'Rev A',
    change_notes: 'Initial drawing upload',
    file: null,
  });

  // History Drawer State
  const [activeDrawingForHistory, setActiveDrawingForHistory] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Upload Revision Modal State
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionForm, setRevisionForm] = useState({
    revision_code: '',
    change_notes: '',
    file: null,
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [dwgRes, partsRes] = await Promise.all([
        getDrawings(),
        getParts()
      ]);
      const dwgList = dwgRes.data?.results ?? dwgRes.data ?? [];
      const partsList = partsRes.data?.results ?? partsRes.data ?? [];
      setDrawings(Array.isArray(dwgList) ? dwgList : []);
      setParts(Array.isArray(partsList) ? partsList : []);
    } catch (err) {
      console.error('Failed to load drawings:', err);
      setErrorMsg('Failed to load drawing documents. Please verify your admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenHistory = async (drawing) => {
    setActiveDrawingForHistory(drawing);
    setLoadingHistory(true);
    try {
      const res = await getDrawingHistory(drawing.id);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Failed to load drawing history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateDrawing = async (e) => {
    e.preventDefault();
    if (!newDrawingForm.drawing_number || !newDrawingForm.title || !newDrawingForm.file) {
      alert('Please fill in Drawing Number, Title, and select a File.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (newDrawingForm.part) formData.append('part', newDrawingForm.part);
    formData.append('drawing_number', newDrawingForm.drawing_number);
    formData.append('title', newDrawingForm.title);
    formData.append('description', newDrawingForm.description);
    formData.append('current_revision', newDrawingForm.revision_code || 'Rev A');
    formData.append('revision_code', newDrawingForm.revision_code || 'Rev A');
    formData.append('change_notes', newDrawingForm.change_notes || 'Initial drawing upload');
    formData.append('file', newDrawingForm.file);

    try {
      await createDrawing(formData);
      setSuccessMsg('Drawing uploaded successfully with initial revision!');
      setIsUploadModalOpen(false);
      setNewDrawingForm({
        part: '',
        drawing_number: '',
        title: '',
        description: '',
        revision_code: 'Rev A',
        change_notes: 'Initial drawing upload',
        file: null,
      });
      fetchData();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.error || err.response?.data?.drawing_number?.[0] || 'Failed to upload drawing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadRevision = async (e) => {
    e.preventDefault();
    if (!activeDrawingForHistory || !revisionForm.revision_code || !revisionForm.file) {
      alert('Please enter Revision Code and select a file.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('revision_code', revisionForm.revision_code);
    formData.append('change_notes', revisionForm.change_notes);
    formData.append('file', revisionForm.file);

    try {
      await uploadDrawingVersion(activeDrawingForHistory.id, formData);
      setSuccessMsg(`New revision ${revisionForm.revision_code} added successfully!`);
      setIsRevisionModalOpen(false);
      setRevisionForm({ revision_code: '', change_notes: '', file: null });
      // Refresh history & drawings
      handleOpenHistory(activeDrawingForHistory);
      fetchData();
    } catch (err) {
      console.error('Revision upload failed:', err);
      alert(err.response?.data?.error || 'Failed to upload new revision.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDrawing = async (drawingId) => {
    if (!window.confirm('Are you sure you want to delete this drawing document?')) return;
    try {
      await deleteDrawing(drawingId);
      setSuccessMsg('Drawing deleted.');
      if (activeDrawingForHistory?.id === drawingId) setActiveDrawingForHistory(null);
      fetchData();
    } catch (err) {
      alert('Failed to delete drawing.');
    }
  };

  const safeDrawings = Array.isArray(drawings) ? drawings : [];
  const filteredDrawings = safeDrawings.filter((dwg) => {
    const q = searchQuery.toLowerCase();
    return (
      dwg.drawing_number?.toLowerCase().includes(q) ||
      dwg.title?.toLowerCase().includes(q) ||
      dwg.part_number?.toLowerCase().includes(q) ||
      dwg.current_revision?.toLowerCase().includes(q)
    );
  });

  if (!isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <ShieldAlert size={56} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Admin Access Only</h2>
        <p style={{ color: '#64748b', margin: '12px 0 24px' }}>
          Drawing management and drawing revision history access is restricted to Administrators.
        </p>
        <NavLink to="/development" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '10px' }}>
          Return to Development Module
        </NavLink>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Back button & Breadcrumb */}
      <div style={{ marginBottom: '16px' }}>
        <NavLink 
          to="/development" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            color: '#6d28d9', 
            fontWeight: '600', 
            textDecoration: 'none',
            fontSize: '14px' 
          }}
        >
          <ArrowLeft size={16} /> Back to Development Module
        </NavLink>
      </div>

      {/* Header Strip with Action */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Engineering Drawings Repository</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Upload CAD/PDF drawings, link drawings to part numbers or general files, and inspect complete revision histories.
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          style={{
            background: '#4f46e5',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: '700',
            border: 'none',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Upload size={18} />
          <span>Upload New Drawing</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #10b981',
          color: '#047857',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
          <X size={16} cursor="pointer" onClick={() => setSuccessMsg('')} />
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #ef4444',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search Bar Strip */}
      <div style={{
        background: '#ffffff',
        padding: '16px 20px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by Drawing Number, Title, or Part Number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>
          Total Drawings: <span style={{ color: '#0f172a', fontWeight: '800' }}>{filteredDrawings.length}</span>
        </div>
      </div>

      {/* Drawings Table */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <Clock size={32} className="spin" style={{ marginBottom: '12px' }} />
          <p>Loading Engineering Drawings Repository...</p>
        </div>
      ) : filteredDrawings.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '2px dashed #cbd5e1'
        }}>
          <FileText size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>No Drawings Found</h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '6px 0 20px' }}>
            {searchQuery ? 'No drawing matches your search.' : 'Upload your first engineering drawing to start revision history tracking.'}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            style={{
              background: '#4f46e5',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Upload size={16} /> Upload Drawing
          </button>
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Drawing Number</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Title & Description</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Linked Part</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Active Revision</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Revisions Log</th>
                <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrawings.map((dwg) => {
                const latestFileUrl = dwg.latest_version?.file_url;
                const totalRevisions = dwg.versions?.length || 0;

                return (
                  <tr key={dwg.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#e0e7ff', padding: '8px', borderRadius: '8px', color: '#4f46e5' }}>
                          <FileCode size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{dwg.drawing_number}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>By {dwg.created_by_name || 'Admin'}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', display: 'block' }}>{dwg.title}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{dwg.description || 'No notes provided'}</span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      {dwg.part_number ? (
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          {dwg.part_number} ({dwg.part_name || ''})
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>General Drawing</span>
                      )}
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {dwg.current_revision}
                      </span>
                    </td>

                    <td style={{ padding: '16px 20px' }}>
                      <button
                        onClick={() => handleOpenHistory(dwg)}
                        style={{
                          background: 'rgba(79, 70, 229, 0.08)',
                          color: '#4f46e5',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <History size={15} />
                        <span>{totalRevisions} {totalRevisions === 1 ? 'Revision' : 'Revisions'}</span>
                      </button>
                    </td>

                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {latestFileUrl ? (
                          <a
                            href={latestFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            style={{
                              background: '#4f46e5',
                              color: '#ffffff',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Download size={14} /> Download File
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>No file</span>
                        )}

                        <button
                          onClick={() => handleDeleteDrawing(dwg.id)}
                          style={{
                            background: '#fef2f2',
                            color: '#ef4444',
                            border: 'none',
                            padding: '8px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                          title="Delete Drawing Document"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload New Drawing Modal */}
      {isUploadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#4f46e5',
              padding: '20px 24px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Upload New Engineering Drawing</h3>
              <X size={20} cursor="pointer" onClick={() => setIsUploadModalOpen(false)} />
            </div>

            <form onSubmit={handleCreateDrawing} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Drawing Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. DWG-2026-001"
                  required
                  value={newDrawingForm.drawing_number}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, drawing_number: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Title / Component Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cylinder Block Assembly Drawing"
                  required
                  value={newDrawingForm.title}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Linked Part (Optional)
                  </label>
                  <select
                    value={newDrawingForm.part}
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, part: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value="">General (No Part Selected)</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>{p.part_number} - {p.part_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Revision Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Rev A, v1.0, etc."
                    value={newDrawingForm.revision_code}
                    onChange={(e) => setNewDrawingForm({ ...newDrawingForm, revision_code: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Drawing File (PDF, DXF, DWG, PNG, JPG) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, file: e.target.files[0] })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Revision Notes / Remarks
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Initial engineering drawing release for production"
                  value={newDrawingForm.change_notes}
                  onChange={(e) => setNewDrawingForm({ ...newDrawingForm, change_notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: '700' }}
                >
                  {submitting ? 'Uploading...' : 'Save & Upload Drawing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision History Drawer / Modal */}
      {activeDrawingForHistory && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#312e81',
              padding: '20px 24px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                  Revision History — {activeDrawingForHistory.drawing_number}
                </h3>
                <span style={{ fontSize: '13px', opacity: 0.85 }}>{activeDrawingForHistory.title}</span>
              </div>
              <X size={20} cursor="pointer" onClick={() => setActiveDrawingForHistory(null)} />
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                  All Historical Revisions ({historyList.length})
                </span>
                <button
                  onClick={() => setIsRevisionModalOpen(true)}
                  style={{
                    background: '#4f46e5',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={16} /> Upload New Revision
                </button>
              </div>

              {loadingHistory ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading history...</div>
              ) : historyList.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No revision entries found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {historyList.map((ver, idx) => (
                    <div key={ver.id} style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: idx === 0 ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: idx === 0 ? '#f5f3ff' : '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <span style={{
                            background: idx === 0 ? '#4f46e5' : '#64748b',
                            color: '#ffffff',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}>
                            {ver.revision_code}
                          </span>
                          {idx === 0 && <span style={{ fontSize: '11px', fontWeight: '800', color: '#4f46e5', textTransform: 'uppercase' }}>Active Revision</span>}
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Uploaded {new Date(ver.uploaded_at).toLocaleString()} by {ver.uploaded_by_name || 'Admin'}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#334155' }}>
                          {ver.change_notes || 'No release notes specified.'}
                        </p>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>File: {ver.file_name || 'drawing file'} ({Math.round((ver.file_size || 0) / 1024)} KB)</span>
                      </div>

                      {ver.file_url ? (
                        <a
                          href={ver.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          style={{
                            background: '#ffffff',
                            color: '#4f46e5',
                            border: '1px solid #cbd5e1',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={14} /> Download
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Revision Modal */}
      {isRevisionModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#4f46e5',
              padding: '18px 24px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                Upload Revision for {activeDrawingForHistory?.drawing_number}
              </h4>
              <X size={18} cursor="pointer" onClick={() => setIsRevisionModalOpen(false)} />
            </div>

            <form onSubmit={handleUploadRevision} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  New Revision Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rev B"
                  value={revisionForm.revision_code}
                  onChange={(e) => setRevisionForm({ ...revisionForm, revision_code: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Revision File *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.dxf,.dwg,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setRevisionForm({ ...revisionForm, file: e.target.files[0] })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Change Notes / ECN Summary
                </label>
                <textarea
                  rows="3"
                  placeholder="Summarize changes introduced in this revision..."
                  value={revisionForm.change_notes}
                  onChange={(e) => setRevisionForm({ ...revisionForm, change_notes: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#ffffff', fontWeight: '700' }}
                >
                  {submitting ? 'Uploading...' : 'Save New Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
