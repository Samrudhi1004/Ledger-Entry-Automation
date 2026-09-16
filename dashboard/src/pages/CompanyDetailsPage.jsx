import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../components/layout/Header';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { getCompanyDetails, updateCompanyDetails, getCompanyPlants } from '../api/company';
import {
  Building2, AlertCircle, CheckCircle2, User, Clock, ShieldCheck, Lock, Save, Loader2
} from 'lucide-react';

export default function CompanyDetailsPage() {
  const { user } = useAuth();
  const { refreshCompany } = useCompany() || {};
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [factoryId, setFactoryId] = useState(null);

  const [company, setCompany] = useState({
    name: '',
    code: '',
    location: '',
    contact_email: '',
    phone: '',
    address: '',
    gstin: '',
    logo_url: '',
    industry_type: '',
    shift_hours: 8,
    total_shifts_per_day: 3,
    lunch_break_minutes: 30,
    tea_break_minutes: 30,
    available_working_minutes: 420,
    is_active: true,
  });

  const [plants, setPlants] = useState([]);

  // Fetch factory and plant details on mount
  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    setError('');
    try {
      const [compRes, plantRes] = await Promise.all([
        getCompanyDetails().catch(() => null),
        getCompanyPlants().catch(() => null),
      ]);

      const compData = compRes?.data?.results || compRes?.data;
      if (compData && (Array.isArray(compData) ? compData.length > 0 : true)) {
        const primary = Array.isArray(compData) ? compData[0] : compData;
        setFactoryId(primary.id);

        const shiftHrs = primary.shift_hours || 8;
        const shiftsPerDay = primary.total_shifts_per_day || (shiftHrs === 12 ? 2 : 3);
        const lunchMins = primary.lunch_break_minutes ?? 30;
        const teaMins = primary.tea_break_minutes ?? 30;
        const grossMins = shiftHrs * 60;
        const availMins = Math.max(0, grossMins - (lunchMins + teaMins));

        setCompany({
          name: primary.name || '',
          code: primary.code || '',
          location: primary.location || '',
          contact_email: primary.contact_email || '',
          phone: primary.phone || '',
          address: primary.address || '',
          gstin: primary.gstin || '',
          logo_url: primary.logo_url || '',
          industry_type: primary.industry_type || '',
          shift_hours: shiftHrs,
          total_shifts_per_day: shiftsPerDay,
          lunch_break_minutes: lunchMins,
          tea_break_minutes: teaMins,
          available_working_minutes: availMins,
          is_active: primary.is_active !== false,
        });
      }

      const plantData = plantRes?.data?.results || plantRes?.data;
      if (plantData) {
        setPlants(Array.isArray(plantData) ? plantData : []);
      }
    } catch (err) {
      console.error('Failed to load company details', err);
      setError('Failed to fetch company details. Using default parameters.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    if (!isAdmin) return;
    const { name, value, type } = e.target;
    setCompany((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleShiftHoursChange = (hours) => {
    if (!isAdmin) return;
    setCompany((prev) => ({
      ...prev,
      shift_hours: hours,
      total_shifts_per_day: hours === 12 ? 2 : 3,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!factoryId) {
      setError('Cannot update company details: Factory record ID not found.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const shiftHrs = Number(company.shift_hours) || 8;
      const shiftsPerDay = shiftHrs === 12 ? 2 : 3;
      const lunchMins = Number(company.lunch_break_minutes) || 0;
      const teaMins = Number(company.tea_break_minutes) || 0;
      const grossMins = shiftHrs * 60;
      const availMins = Math.max(0, grossMins - (lunchMins + teaMins));

      const payload = {
        name: company.name,
        code: company.code,
        location: company.location,
        contact_email: company.contact_email,
        phone: company.phone,
        address: company.address,
        gstin: company.gstin,
        logo_url: company.logo_url,
        industry_type: company.industry_type,
        shift_hours: shiftHrs,
        total_shifts_per_day: shiftsPerDay,
        lunch_break_minutes: lunchMins,
        tea_break_minutes: teaMins,
        available_working_minutes: availMins,
      };

      const res = await updateCompanyDetails(factoryId, payload);
      if (res?.data) {
        if (refreshCompany) refreshCompany();
        setSuccessMsg('Company & Shift details saved successfully!');
        setTimeout(() => setSuccessMsg(''), 4500);
      }
    } catch (err) {
      console.error('Failed to update company details', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'object'
          ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
          : null) ||
        'Failed to save company details. Please try again.';
      setError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations for live UI feedback
  const grossShiftMins = (Number(company.shift_hours) || 8) * 60;
  const totalBreakMins = (Number(company.lunch_break_minutes) || 0) + (Number(company.tea_break_minutes) || 0);
  const netAvailableWorkingMins = Math.max(0, grossShiftMins - totalBreakMins);
  const dailyTotalUptimeMins = netAvailableWorkingMins * (company.total_shifts_per_day || 3);

  const inputStyle = (isMono = false) => ({
    background: isAdmin ? 'var(--bg-elevated)' : '#f8fafc',
    color: '#0f172a',
    fontWeight: isAdmin ? 500 : 600,
    cursor: isAdmin ? 'text' : 'default',
    fontFamily: isMono ? 'monospace' : 'inherit',
    borderColor: 'var(--border)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  });

  return (
    <>
      <Header
        title="Company & Organization Details"
        subtitle="Registered office identifiers, factory profile, and operating shift standards"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Breadcrumbs items={[{ label: 'Company Details' }]} />

          {/* ── Sub-Navigation Tabs ────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--bg-card)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <NavLink
              to="/profile"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                background: isActive ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent',
                boxShadow: isActive ? '0 2px 8px rgba(15,23,42,0.25)' : 'none',
                transition: 'all 0.2s ease',
              })}
            >
              <User size={16} /> My Profile
            </NavLink>

            <NavLink
              to="/company"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.88rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                background: isActive ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'transparent',
                boxShadow: isActive ? '0 2px 8px rgba(15,23,42,0.25)' : 'none',
                transition: 'all 0.2s ease',
              })}
            >
              <Building2 size={16} /> Company Details
            </NavLink>
          </div>

          {/* ── Main Organization Card ────────────────────────────────────────── */}
          <div className="card" style={{ padding: '32px' }}>
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 24,
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Building2 size={20} color="var(--accent-blue)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Company Profile & Registration Details
                  </h3>
                </div>

                {isAdmin ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#0284c7',
                      background: 'rgba(2, 132, 199, 0.1)',
                      border: '1px solid rgba(2, 132, 199, 0.25)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                    }}
                  >
                    <ShieldCheck size={14} /> Admin Edit Mode
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                    }}
                  >
                    <Lock size={13} /> Read-Only View
                  </span>
                )}
              </div>

              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {successMsg && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#16a34a',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <CheckCircle2 size={16} /> {successMsg}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Row 1: Name & Code */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Company / Factory Name {isAdmin && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      className="form-input"
                      name="name"
                      value={company.name}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      required={isAdmin}
                      placeholder="e.g. Liha Tech Factory 1"
                      style={inputStyle()}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Factory Code {isAdmin && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      className="form-input font-mono"
                      name="code"
                      value={company.code}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      required={isAdmin}
                      placeholder="e.g. FAC-01"
                      style={inputStyle(true)}
                    />
                  </div>
                </div>

                {/* Row 2: Location & Industry Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Factory Location / City</label>
                    <input
                      className="form-input"
                      name="location"
                      value={company.location}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      placeholder="e.g. Pune, Maharashtra"
                      style={inputStyle()}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Industry Type</label>
                    <input
                      className="form-input"
                      name="industry_type"
                      value={company.industry_type}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      placeholder="e.g. Precision Component Manufacturing"
                      style={inputStyle()}
                    />
                  </div>
                </div>

                {/* Row 3: Email & Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Official Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      name="contact_email"
                      value={company.contact_email}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      placeholder="e.g. contact@company.com"
                      style={inputStyle()}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contact Phone Number</label>
                    <input
                      className="form-input"
                      name="phone"
                      value={company.phone}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      placeholder="e.g. +91 9876543210"
                      style={inputStyle()}
                    />
                  </div>
                </div>

                {/* Row 4: GSTIN & Company Logo URL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">GSTIN / Tax Registration No.</label>
                    <input
                      className="form-input font-mono"
                      name="gstin"
                      value={company.gstin}
                      readOnly={!isAdmin}
                      onChange={handleChange}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      style={inputStyle(true)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Company Logo URL (Reports & PDFs)</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        className="form-input"
                        name="logo_url"
                        value={company.logo_url || ''}
                        readOnly={!isAdmin}
                        onChange={handleChange}
                        placeholder="https://... or /logo.png"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                      {company.logo_url && (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                            padding: 2,
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={company.logo_url}
                            alt="Logo"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 5: Registered Address */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Registered Office Address</label>
                  <textarea
                    className="form-input"
                    name="address"
                    rows={2}
                    value={company.address}
                    readOnly={!isAdmin}
                    onChange={handleChange}
                    placeholder="Enter complete facility or registered office address..."
                    style={{
                      ...inputStyle(),
                      resize: isAdmin ? 'vertical' : 'none',
                    }}
                  />
                </div>

                {/* ── Section 2: Shift & Operating Hours Configuration ──────────────── */}
                <div style={{ marginTop: 12, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <Clock size={19} color="var(--accent-blue)" />
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Shift & Operating Standards
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Factory shift duration, meal deductions, and net available operating time.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Shift Pattern Display / Select */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: 10 }}>
                        Factory Shift Pattern {isAdmin && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--accent-blue)' }}>(Select to configure)</span>}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div
                          onClick={() => handleShiftHoursChange(8)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: 'var(--radius-md)',
                            border:
                              Number(company.shift_hours) === 8
                                ? '2px solid var(--accent-blue)'
                                : '1px solid var(--border)',
                            background:
                              Number(company.shift_hours) === 8
                                ? 'rgba(56,189,248,0.08)'
                                : 'var(--bg-elevated)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: isAdmin ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="shift_hours_radio"
                            checked={Number(company.shift_hours) === 8}
                            disabled={!isAdmin}
                            onChange={() => handleShiftHoursChange(8)}
                            style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16, cursor: isAdmin ? 'pointer' : 'default' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              8-Hour Shift Pattern
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              3 Shifts / Day • 480 mins gross duration
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => handleShiftHoursChange(12)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: 'var(--radius-md)',
                            border:
                              Number(company.shift_hours) === 12
                                ? '2px solid var(--accent-blue)'
                                : '1px solid var(--border)',
                            background:
                              Number(company.shift_hours) === 12
                                ? 'rgba(56,189,248,0.08)'
                                : 'var(--bg-elevated)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            cursor: isAdmin ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="shift_hours_radio"
                            checked={Number(company.shift_hours) === 12}
                            disabled={!isAdmin}
                            onChange={() => handleShiftHoursChange(12)}
                            style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16, cursor: isAdmin ? 'pointer' : 'default' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              12-Hour Shift Pattern
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              2 Shifts / Day • 720 mins gross duration
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Break Inputs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Lunch / Dinner Break (mins)</label>
                        <input
                          className="form-input font-mono"
                          type="number"
                          min="0"
                          max="180"
                          name="lunch_break_minutes"
                          value={company.lunch_break_minutes}
                          readOnly={!isAdmin}
                          onChange={handleChange}
                          style={inputStyle(true)}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Tea & Rest Breaks (mins)</label>
                        <input
                          className="form-input font-mono"
                          type="number"
                          min="0"
                          max="180"
                          name="tea_break_minutes"
                          value={company.tea_break_minutes}
                          readOnly={!isAdmin}
                          onChange={handleChange}
                          style={inputStyle(true)}
                        />
                      </div>
                    </div>

                    {/* Operating Capacity Summary Card */}
                    <div
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '20px 24px',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          letterSpacing: '0.06em',
                          marginBottom: 14,
                        }}
                      >
                        Operating Capacity Summary
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: 20,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gross Shift Duration</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                            {grossShiftMins}{' '}
                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                              mins ({company.shift_hours} hrs)
                            </span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Break Deductions</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e11d48', marginTop: 2 }}>
                            -{totalBreakMins}{' '}
                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>mins</span>
                          </div>
                        </div>

                        <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent-blue)' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                            Net Available Working Time
                          </div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                            {netAvailableWorkingMins}{' '}
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              mins / shift
                            </span>
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Total Plant Uptime: {dailyTotalUptimeMins} mins ({company.total_shifts_per_day} shifts/day)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Admin Action Bar ────────────────────────────────────────────── */}
                {isAdmin && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 20,
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 16,
                    }}
                  >
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSaving || loading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 24px',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(56, 189, 248, 0.25)',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save Company Details
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
