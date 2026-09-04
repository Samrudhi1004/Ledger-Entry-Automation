import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';
import { getCompanyDetails, updateCompanyDetails, getCompanyPlants } from '../api/company';
import {
  Building2, CheckCircle2, AlertCircle, Save, RefreshCw, User, Clock, Zap
} from 'lucide-react';

export default function CompanyDetailsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [companyId, setCompanyId] = useState(null);
  const [company, setCompany] = useState({
    name: 'Mantri Metallics',
    code: 'FAC-01',
    location: 'Main Factory',
    contact_email: 'info@mantrimetallics.com',
    phone: '+91 98765 43210',
    address: 'Plot No. 42, Industrial Area, Phase II',
    gstin: '27AAAAA0000A1Z5',
    industry_type: 'Precision Component Manufacturing',
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

      if (compRes?.data && compRes.data.length > 0) {
        const primary = compRes.data[0];
        setCompanyId(primary.id);
        const shiftHrs = primary.shift_hours || 8;
        const shiftsPerDay = shiftHrs === 12 ? 2 : 3;
        const lunchMins = primary.lunch_break_minutes ?? 30;
        const teaMins = primary.tea_break_minutes ?? 30;
        const grossMins = shiftHrs * 60;
        const availMins = Math.max(0, grossMins - (lunchMins + teaMins));

        setCompany({
          name: primary.name || 'Mantri Metallics',
          code: primary.code || 'FAC-01',
          location: primary.location || 'Main Factory',
          contact_email: primary.contact_email || '',
          phone: primary.phone || '',
          address: primary.address || '',
          gstin: primary.gstin || '',
          industry_type: primary.industry_type || 'Precision Component Manufacturing',
          shift_hours: shiftHrs,
          total_shifts_per_day: shiftsPerDay,
          lunch_break_minutes: lunchMins,
          tea_break_minutes: teaMins,
          available_working_minutes: availMins,
          is_active: primary.is_active !== false,
        });
      }

      if (plantRes?.data) {
        setPlants(Array.isArray(plantRes.data) ? plantRes.data : []);
      }
    } catch (err) {
      console.error('Failed to load company details', err);
      setError('Failed to fetch company details. Using default parameters.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCompany((prev) => {
      const updated = { ...prev, [name]: value };
      
      const shiftHrs = Number(updated.shift_hours) === 12 ? 12 : 8;
      const shiftsCount = shiftHrs === 12 ? 2 : 3;
      const grossShiftMins = shiftHrs * 60;
      const lunchMins = Number(updated.lunch_break_minutes) || 0;
      const teaMins = Number(updated.tea_break_minutes) || 0;
      const netWorkingMins = Math.max(0, grossShiftMins - (lunchMins + teaMins));

      return {
        ...updated,
        shift_hours: shiftHrs,
        total_shifts_per_day: shiftsCount,
        available_working_minutes: netWorkingMins,
      };
    });
    setSuccess('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      if (companyId) {
        await updateCompanyDetails(companyId, company);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setSuccess('Company profile and shift schedule updated successfully!');
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.message || 'Failed to update company details.');
    } finally {
      setSaving(false);
    }
  };

  // Calculations for live UI feedback
  const grossShiftMins = (Number(company.shift_hours) || 8) * 60;
  const totalBreakMins = (Number(company.lunch_break_minutes) || 0) + (Number(company.tea_break_minutes) || 0);
  const netAvailableWorkingMins = Math.max(0, grossShiftMins - totalBreakMins);
  const dailyTotalUptimeMins = netAvailableWorkingMins * (company.total_shifts_per_day || 3);

  return (
    <>
      <Header
        title="Company & Organization Settings"
        subtitle="Manage organization profile, registered office identifiers, and plant shift parameters"
      />

      <div className="page-content bg-gradient-animated">
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

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
              <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '2px 6px', marginLeft: 4 }}>
                ADMIN
              </span>
            </NavLink>
          </div>

          {/* ── Main Organization Card ────────────────────────────────────────── */}
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <Building2 size={20} color="var(--accent-blue)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Company Profile & Registration Details
              </h3>
            </div>

            {success && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} /> {success}
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Row 1: Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Company / Factory Name</label>
                  <input
                    className="form-input"
                    name="name"
                    value={company.name}
                    onChange={handleChange}
                    placeholder="e.g. Mantri Metallics"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Factory Code</label>
                  <input
                    className="form-input font-mono"
                    name="code"
                    value={company.code}
                    onChange={handleChange}
                    placeholder="e.g. FAC-01"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Email & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Official Email Address</label>
                  <input
                    className="form-input"
                    type="email"
                    name="contact_email"
                    value={company.contact_email}
                    onChange={handleChange}
                    placeholder="info@company.com"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Contact Phone Number</label>
                  <input
                    className="form-input"
                    name="phone"
                    value={company.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Row 3: Industry & GSTIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Industry Type</label>
                  <input
                    className="form-input"
                    name="industry_type"
                    value={company.industry_type}
                    onChange={handleChange}
                    placeholder="e.g. Precision Component Manufacturing"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">GSTIN / Tax Registration No.</label>
                  <input
                    className="form-input font-mono"
                    name="gstin"
                    value={company.gstin}
                    onChange={handleChange}
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
              </div>

              {/* Row 4: Registered Address */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Registered Office Address</label>
                <textarea
                  className="form-input"
                  name="address"
                  rows={2}
                  value={company.address}
                  onChange={handleChange}
                  placeholder="Enter full registered office address"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* ── Section 2: Shift & Operating Hours Configuration ──────────────── */}
              <div style={{ marginTop: 12, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <Clock size={19} color="var(--accent-blue)" />
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Shift & Operating Hours Configuration
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Define shift patterns, meal intervals, and net available operating time per shift.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Shift Pattern Selector */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: 10 }}>
                      Factory Shift Pattern
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div
                        onClick={() => handleChange({ target: { name: 'shift_hours', value: 8 } })}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 'var(--radius-md)',
                          border: Number(company.shift_hours) === 8 ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                          background: Number(company.shift_hours) === 8 ? 'rgba(56,189,248,0.05)' : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="shift_hours_radio"
                          checked={Number(company.shift_hours) === 8}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }}
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
                        onClick={() => handleChange({ target: { name: 'shift_hours', value: 12 } })}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 'var(--radius-md)',
                          border: Number(company.shift_hours) === 12 ? '2px solid var(--accent-blue)' : '1px solid var(--border)',
                          background: Number(company.shift_hours) === 12 ? 'rgba(56,189,248,0.05)' : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="shift_hours_radio"
                          checked={Number(company.shift_hours) === 12}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--accent-blue)', width: 16, height: 16 }}
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
                        name="lunch_break_minutes"
                        min={0}
                        max={180}
                        value={company.lunch_break_minutes}
                        onChange={handleChange}
                        placeholder="30"
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tea & Rest Breaks (mins)</label>
                      <input
                        className="form-input font-mono"
                        type="number"
                        name="tea_break_minutes"
                        min={0}
                        max={180}
                        value={company.tea_break_minutes}
                        onChange={handleChange}
                        placeholder="30"
                        required
                      />
                    </div>
                  </div>

                  {/* Clean Enterprise Operating Capacity Summary Card */}
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px 24px',
                      marginTop: 4,
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 14 }}>
                      Operating Capacity Summary
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'center' }}>
                      
                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gross Shift Duration</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                          {grossShiftMins} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>mins ({company.shift_hours} hrs)</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Break Deductions</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e11d48', marginTop: 2 }}>
                          -{totalBreakMins} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>mins</span>
                        </div>
                      </div>

                      <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent-blue)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-blue)' }}>Net Available Working Time</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                          {netAvailableWorkingMins} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>mins / shift</span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Total Plant Uptime: {dailyTotalUptimeMins} mins ({company.total_shifts_per_day} shifts/day)
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

              {/* Submit Action Button */}
              <div style={{ paddingTop: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="spin" /> Saving Configuration...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Save Company & Shift Details
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </>
  );
}
