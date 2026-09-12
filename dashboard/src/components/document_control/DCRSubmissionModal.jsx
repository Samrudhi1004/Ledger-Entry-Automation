import React, { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle, FileText, UserCheck, Shield } from 'lucide-react';
import Select from 'react-select';
import { submitDCR, getAssignableUsers, getDocuments } from '../../api/documentControl';
import { useAuth } from '../../context/AuthContext';

export default function DCRSubmissionModal({ doc, onClose, onSuccess }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [docsList, setDocsList] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(doc || null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successDcr, setSuccessDcr] = useState(null);

  const [form, setForm] = useState({
    document: doc?.id || '',
    form_doc_no: 'DKI/MR/F/05',
    issue_no_date: '01/01.04.2018',
    rev_no_date: '01/01.04.2018',
    document_description: '',
    basis_for_change: '',
    assigned_cft_reviewer: '',
    assigned_approver: '',
  });

  useEffect(() => {
    if (!doc) {
      getDocuments()
        .then(res => {
          const list = res.data?.results || res.data || [];
          setDocsList(list);
          if (list.length > 0 && !form.document) {
            setSelectedDoc(list[0]);
            setForm(prev => ({ ...prev, document: list[0].id }));
          }
        })
        .catch(err => console.error("Failed to load documents", err));
    }
  }, [doc]);

  useEffect(() => {
    getAssignableUsers()
      .then(res => {
        setUsers(res.data || []);
        // Auto-select first admin as default approver if available
        const defaultAdmin = (res.data || []).find(u => u.role === 'admin');
        if (defaultAdmin) {
          setForm(prev => ({ ...prev, assigned_approver: defaultAdmin.id }));
        }
      })
      .catch(err => {
        console.error("Failed to load assignable users", err);
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetDocId = form.document || doc?.id;
    if (!targetDocId) {
      return setError('Please select a target document.');
    }
    if (!form.document_description.trim()) {
      return setError('Please describe the current document content or section to be changed.');
    }
    if (!form.basis_for_change.trim()) {
      return setError('Please specify the technical basis / justification for change.');
    }
    if (!form.assigned_cft_reviewer) {
      return setError('Please select a Cross-Functional Team (CFT) Reviewer.');
    }
    if (!form.assigned_approver) {
      return setError('Please select a Management Representative (Admin) Approver.');
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await submitDCR({
        document: targetDocId,
        form_doc_no: form.form_doc_no.trim() || 'DKI/MR/F/05',
        issue_no_date: form.issue_no_date.trim() || '01/01.04.2018',
        rev_no_date: form.rev_no_date.trim() || '01/01.04.2018',
        document_description: form.document_description,
        basis_for_change: form.basis_for_change,
        assigned_cft_reviewer: form.assigned_cft_reviewer,
        assigned_approver: form.assigned_approver,
      });
      setSuccessDcr(res.data);
      if (onSuccess) onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to submit Change Request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Backend now handles exclusion of operator and currentUser
  const selectOptions = users.map(u => ({
    value: u.id,
    label: `${u.name} (${u.role})`
  }));
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      zIndex: 1300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Standard Form DKI/MR/F/05
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Raise Document Change Request (DCR)
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {successDcr ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#0f172a' }}>
                Change Request Submitted Successfully!
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b' }}>
                Your DCR reference is <strong>{successDcr.dcr_number}</strong>.<br />
                The assigned CFT Reviewer has been notified via In-App popup and email.
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Close & Return
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Document Reference Box */}
              <div style={{
                backgroundColor: '#f1f5f9',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                {doc ? (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      Target Document
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                      {doc?.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Code: <strong>{doc?.document_number}</strong> • Rev: <strong>{doc?.revision}</strong> • Level: <strong>{doc?.doc_level}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Select Target Document to Modify
                    </span>
                    <select
                      value={form.document}
                      onChange={e => {
                        const found = docsList.find(d => String(d.id) === String(e.target.value));
                        setSelectedDoc(found);
                        setForm({ ...form, document: e.target.value });
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: '600',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <option value="">-- Choose Document to Change --</option>
                      {docsList.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.document_number} — {d.title} (Rev: {d.revision})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{
                  backgroundColor: '#e0e7ff',
                  color: '#4f46e5',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  alignSelf: 'flex-start',
                }}>
                  DKI/MR/F/05
                </div>
              </div>

              {error && (
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Header References (Editable DKI/MR/F/05 metadata) */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} /> Form Header References (Editable Standard Form Metadata)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Doc No
                    </label>
                    <input
                      type="text"
                      value={form.form_doc_no}
                      onChange={e => setForm({ ...form, form_doc_no: e.target.value })}
                      placeholder="DKI/MR/F/05"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Issue No / Date
                    </label>
                    <input
                      type="text"
                      value={form.issue_no_date}
                      onChange={e => setForm({ ...form, issue_no_date: e.target.value })}
                      placeholder="01/01.04.2018"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Rev No / Date
                    </label>
                    <input
                      type="text"
                      value={form.rev_no_date}
                      onChange={e => setForm({ ...form, rev_no_date: e.target.value })}
                      placeholder="01/01.04.2018"
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 1. Document Description */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                  1. Document Description (Current Text / Specification) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.document_description}
                  onChange={e => setForm({ ...form, document_description: e.target.value })}
                  placeholder="Summarize the current content, clause, or operating parameters that need modification..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* 2. Basis for Change */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                  2. Basis for Change (Technical Justification / Customer Req / CAPA) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.basis_for_change}
                  onChange={e => setForm({ ...form, basis_for_change: e.target.value })}
                  placeholder="Explain why this change is required (e.g. process optimization, audit finding, tool redesign)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Section 3: User Assignments */}
              <div style={{
                backgroundColor: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#6b21a8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} /> Assign Reviewers & Approver (Form Sign-Off)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '14px' }}>
                  {/* CFT Reviewer */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                      CFT Reviewer <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <Select
                      value={selectOptions.find(opt => opt.value === form.assigned_cft_reviewer) || null}
                      onChange={selected => setForm({ ...form, assigned_cft_reviewer: selected?.value || '' })}
                      options={selectOptions}
                      isDisabled={loadingUsers}
                      placeholder="-- Search / Select CFT Reviewer --"
                      styles={{
                        control: (base) => ({
                          ...base,
                          borderColor: '#cbd5e1',
                          fontSize: '13px',
                          borderRadius: '6px',
                        }),
                      }}
                    />
                  </div>
                </div>

                {/* Approver (Admin / MR) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' }}>
                    Management Representative / Admin Approver <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Select
                    value={selectOptions.find(opt => opt.value === form.assigned_approver) || null}
                    onChange={selected => setForm({ ...form, assigned_approver: selected?.value || '' })}
                    options={selectOptions}
                    isDisabled={loadingUsers}
                    placeholder="-- Search / Select Admin Approver --"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderColor: '#cbd5e1',
                        fontSize: '13px',
                        borderRadius: '6px',
                      }),
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                  }}
                >
                  <Send size={15} />
                  {submitting ? 'Submitting...' : 'Submit DCR Note'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
