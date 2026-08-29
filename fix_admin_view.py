import re

file_path = 'dashboard/src/components/parameters/AdminParametersView.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add fetchError state
content = content.replace(
    "const [loading, setLoading] = useState(true);",
    "const [loading, setLoading] = useState(true);\n  const [fetchError, setFetchError] = useState(null);"
)

# 2. Fix fetchData to use AbortController and handle error
fetch_data_old = """  useEffect(() => {
    fetchData(); // Initial load

    // Silent Auto-Refresh polling every 10 seconds
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [prodRes, procRes] = await Promise.all([
        getAllParameters(),
        getAllProcessParameters()
      ]);
      
      const products = (prodRes.data?.results || prodRes.data || []).map(p => ({ ...p, param_type: 'Product' }));
      const processes = (procRes.data?.results || procRes.data || []).map(p => ({ ...p, param_type: 'Process' }));
      
      // Combine both lists
      setAllParams([...products, ...processes]);
    } catch (err) {
      console.error('Failed to fetch parameters', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };"""

fetch_data_new = """  useEffect(() => {
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
  }, []);"""

content = content.replace(fetch_data_old, fetch_data_new)

# 3. Fix Timezone date
date_old = """    if (filterDate && p.created_at) {
      // HTML date is YYYY-MM-DD. Convert to "DD MMM YYYY" (e.g. 2026-08-27 -> 27 Aug 2026)
      // Note: Date parsing can sometimes be tricky due to timezones, but this simple string mapping works well for the format we used.
      const dateObj = new Date(filterDate);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const monthStr = dateObj.toLocaleString('en-GB', { month: 'short' }); // "Aug"
      const year = dateObj.getFullYear();
      const dateString = ${day}  ;
      matchesDate = p.created_at.includes(dateString);
    }"""

date_new = """    if (filterDate && p.created_at) {
      // Safely parse local date without timezone shifting
      const [yearStr, monthStrNum, dayStr] = filterDate.split('-');
      const dateObj = new Date(yearStr, parseInt(monthStrNum) - 1, dayStr);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const monthStr = dateObj.toLocaleString('en-GB', { month: 'short' }); 
      const year = dateObj.getFullYear();
      const dateString = ${day}  ;
      matchesDate = p.created_at.includes(dateString);
    }"""

content = content.replace(date_old, date_new)

# 4. Fix table body (error state)
table_old = """            <tbody>
              {loading && allParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading parameters...</td></tr>
              ) : filteredParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No parameters found matching filters.</td></tr>
              ) : ("""

table_new = """            <tbody>
              {loading && allParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading parameters...</td></tr>
              ) : fetchError && allParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#EF4444', background: '#FEF2F2' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Failed to load parameters</div>
                  <div style={{ fontSize: 12, color: '#B91C1C' }}>{fetchError}</div>
                </td></tr>
              ) : filteredParams.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No parameters found matching filters.</td></tr>
              ) : ("""

content = content.replace(table_old, table_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed AdminParametersView.jsx')
