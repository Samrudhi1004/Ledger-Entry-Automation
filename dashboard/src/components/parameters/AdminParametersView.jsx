import { useState, useEffect } from 'react';
import { getAllParameters, getAllProcessParameters } from '../../api/parts';
import { Search, Filter, Calendar, User, Settings2 } from 'lucide-react';

export default function AdminParametersView() {
  const [allParams, setAllParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  
  // Advanced Filters
  const [searchName, setSearchName] = useState('');
  const [filterMachine, setFilterMachine] = useState('All');
  const [filterCreatedBy, setFilterCreatedBy] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('All'); // Product, Process

  useEffect(() => {
    let abortController = new AbortController();
    
    const loadData = async (showLoader = true) => {
      if (showLoader) setLoading(true);
      setFetchError(null);
      try {
        const [prodRes, procRes] = await Promise.all([
          getAllParameters({ signal: abortController.signal }),
          getAllProcessParameters({ signal: abortController.signal })
        ]);
        
        const products = (prodRes.data?.results || prodRes.data || []).map(p => ({ ...p, param_type: 'Product' }));
        const processes = (procRes.data?.results || procRes.data || []).map(p => ({ ...p, param_type: 'Process' }));
        
        setAllParams([...products, ...processes]);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.message !== 'canceled') {
          console.error('Failed to fetch parameters', err);
          setFetchError(err.message || 'Failed to fetch parameters');
        }
      } finally {
        if (showLoader) setLoading(false);
      }
    };

    loadData(); // Initial load

    // Silent Auto-Refresh polling every 10 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 10000);

    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, []);

  const uniqueMachines = ['All', ...new Set(allParams.map(p => p.machine_code).filter(Boolean))];
  const uniqueCreators = ['All', ...new Set(allParams.map(p => p.created_by_name).filter(Boolean))];

  const filteredParams = allParams.filter(p => {
    // 1. Name Match (checks parameter name or code or part)
    const matchesName = !searchName || 
                        p.parameter_name?.toLowerCase().includes(searchName.toLowerCase()) ||
                        p.parameter_code?.toLowerCase().includes(searchName.toLowerCase()) ||
                        p.part_number?.toLowerCase().includes(searchName.toLowerCase());
    
    // 2. Machine Match
    const matchesMachine = filterMachine === 'All' || p.machine_code === filterMachine;
    
    // 3. Creator Match
    const matchesCreator = filterCreatedBy === 'All' || p.created_by_name === filterCreatedBy;
    
    // 4. Type Match
    const matchesType = filterType === 'All' || p.param_type === filterType;
    
    // 5. Date Match (simple string inclusion, since created_at is formatted "27 Aug 2026, 03:40 PM")
    let matchesDate = true;
    if (filterDate && p.created_at) {
      const dateObj = new Date(filterDate);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const monthStr = dateObj.toLocaleString('en-GB', { month: 'short' });
      const year = dateObj.getFullYear();
      const dateString = `${day} ${monthStr} ${year}`;
      matchesDate = p.created_at.includes(dateString);
    }

    return matchesName && matchesMachine && matchesCreator && matchesType && matchesDate;
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>
          Global Parameters List
        </h1>
        <p style={{ color: '#64748B', fontSize: 14, margin: '4px 0 0 0' }}>
          Combined read-only view of all Product and Process parameters created by Supervisors.
        </p>
      </div>

      {/* Advanced Filters Panel */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#0F172A', fontWeight: 600 }}>
          <Filter size={18} />
          <span>Advanced Filters</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          
          {/* Parameter Name / Code Search */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Search Name/Part</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Machine Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Machine</label>
            <div style={{ position: 'relative' }}>
              <Settings2 size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <select 
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13, background: '#FFF' }}
              >
                {uniqueMachines.map(m => (
                  <option key={m} value={m}>{m === 'All' ? 'All Machines' : m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Created By Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Created By</label>
            <div style={{ position: 'relative' }}>
              <User size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <select 
                value={filterCreatedBy}
                onChange={(e) => setFilterCreatedBy(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13, background: '#FFF' }}
              >
                {uniqueCreators.map(c => (
                  <option key={c} value={c}>{c === 'All' ? 'All Supervisors' : c}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Type Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Parameter Type</label>
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13, background: '#FFF' }}
            >
              <option value="All">All Types</option>
              <option value="Product">Product Parameters</option>
              <option value="Process">Process Parameters</option>
            </select>
          </div>

          {/* Date Created Filter */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Date Created</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 6, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13, fontFamily: 'inherit' }}
              />
            </div>
          </div>
          
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Type</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Machine / Part</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Operation</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Parameter Name</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Target</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tolerance</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Created By</th>
                <th style={{ padding: '14px 16px', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {loading && allParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading parameters...</td></tr>
              ) : fetchError && allParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#EF4444', background: '#FEF2F2' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Failed to load parameters</div>
                  <div style={{ fontSize: 12, color: '#B91C1C' }}>{fetchError}</div>
                </td></tr>
              ) : filteredParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No parameters found matching filters.</td></tr>
              ) : (
                filteredParams.map((p, index) => (
                  <tr key={`${p.id}-${index}`} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ 
                        background: p.param_type === 'Product' ? '#EFF6FF' : '#EEF2FF', 
                        color: p.param_type === 'Product' ? '#0284C7' : '#4F46E5', 
                        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: p.param_type === 'Product' ? '1px solid #BAE6FD' : '1px solid #C7D2FE'
                      }}>
                        {p.param_type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{p.machine_code || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{p.part_number || '—'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {p.template_name || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{p.parameter_name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: 'monospace' }}>{p.parameter_code}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
                      {p.nominal_value != null ? `${p.nominal_value} ${p.unit || ''}` : p.specification || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748B' }}>
                      {p.upper_tolerance != null ? `+${p.upper_tolerance} / -${p.lower_tolerance}` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748B' }}>
                      {p.created_by_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748B' }}>
                      {p.created_at || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
