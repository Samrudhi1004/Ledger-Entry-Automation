import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { useAuth } from '../../context/AuthContext';
import { getCompanyDetails } from '../../api/company';
import { Edit3 } from 'lucide-react';

export default function CompanyDetailsModal({ onClose }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      try {
        setLoading(true);
        const res = await getCompanyDetails();
        const data = res?.data?.results || res?.data;
        if (isMounted && data && (Array.isArray(data) ? data.length > 0 : true)) {
          const primary = Array.isArray(data) ? data[0] : data;
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
            shift_hours: primary.shift_hours || 8,
            total_shifts_per_day: primary.total_shifts_per_day || 3,
            lunch_break_minutes: primary.lunch_break_minutes ?? 30,
            tea_break_minutes: primary.tea_break_minutes ?? 30,
            available_working_minutes: primary.available_working_minutes || 420,
            is_active: primary.is_active !== false,
          });
        }
      } catch (err) {
        console.error('Failed to load company details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, []);

  const shiftHrs = Number(company.shift_hours) || 8;
  const shiftsPerDay = Number(company.total_shifts_per_day) || 3;
  const lunchMins = Number(company.lunch_break_minutes) || 0;
  const teaMins = Number(company.tea_break_minutes) || 0;
  const totalBreakMins = lunchMins + teaMins;
  const grossShiftMins = shiftHrs * 60;
  const netWorkingMins = Math.max(0, grossShiftMins - totalBreakMins);
  const dailyTotalUptimeMins = netWorkingMins * shiftsPerDay;

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      {isAdmin ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            onClose();
            navigate('/company');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: '0.85rem',
            color: 'var(--accent-blue)',
            borderColor: 'rgba(56, 189, 248, 0.4)',
            background: 'rgba(56, 189, 248, 0.06)',
            cursor: 'pointer',
          }}
        >
          <Edit3 size={15} /> Edit Company Details
        </button>
      ) : (
        <div />
      )}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClose}
        style={{ minWidth: 90, padding: '8px 18px', fontSize: '0.85rem' }}
      >
        Close
      </button>
    </div>
  );

  const renderValue = (val, isMono = false) => {
    if (!val || val.trim() === '') {
      return <span style={{ color: 'var(--text-muted)' }}>-</span>;
    }
    return (
      <span style={{ fontFamily: isMono ? 'monospace' : 'inherit', color: 'var(--text-primary)', fontWeight: 500 }}>
        {val}
      </span>
    );
  };

  return (
    <Modal
      title="Company Details"
      onClose={onClose}
      footer={footer}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Loading details...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
              }}
            >
              <img
                src={company.logo_url || '/apple-touch-icon.png'}
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.src = '/apple-touch-icon.png'; }}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {company.name || 'Liha Tech Factory 1'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {company.code ? `Code: ${company.code}` : ''}
                {company.code && company.location ? ' • ' : ''}
                {company.location || ''}
              </div>
            </div>
          </div>

          {/* Section: General Specifications */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              General Information
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ width: '38%', padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Company Name
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.name)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Factory Code
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.code, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Location
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.location)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Industry Type
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.industry_type)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    GSTIN
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.gstin, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Official Email
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.contact_email)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Phone
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.phone)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Registered Address
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {renderValue(company.address)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section: Shift Standards */}
          <div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Shift & Operating Standards
            </div>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ width: '38%', padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Shift Pattern
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {shiftHrs}-Hour Pattern ({shiftsPerDay} Shifts / Day)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Break Deductions
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Lunch: {lunchMins}m • Tea: {teaMins}m (Total: {totalBreakMins} mins)
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
                    Available Working Time
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {netWorkingMins} mins / shift ({dailyTotalUptimeMins} mins / day)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
