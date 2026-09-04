import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminParametersView from '../components/parameters/AdminParametersView';
import {
  getParts,
  createPart,
  updatePart,
  deletePart,
  getPartTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  publishTemplate,
  getTemplateParameters,
  createParameter,
  updateParameter,
  deleteParameter,
  getProcessParameters,
  createProcessParameter,
  updateProcessParameter,
  deleteProcessParameter,
} from '../api/parts';
import api from '../api/axios';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Header from '../components/layout/Header';

const extractErrorMessage = (err, fallback) => {
  if (!err.response?.data) return fallback;
  const data = err.response.data;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, val]) => `${key.replace('_', ' ')}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join(' | ');
  }
  return fallback;
};

export default function ParametersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (isAdmin) {
    return <AdminParametersView />;
  }
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [parameters, setParameters] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeParamTab, setActiveParamTab] = useState('product'); // 'product', 'process'

  // Modals
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [machineForm, setMachineForm] = useState({ machine_code: '', name: '', machine_type: 'CNC' });

  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partForm, setPartForm] = useState({
    part_number: '',
    part_name: '',
    drawing_number: '',
    revision: 'A',
    description: '',
  });

  const [showAddOpModal, setShowAddOpModal] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [newOpType, setNewOpType] = useState('first_piece');
  const [newOpTargetCount, setNewOpTargetCount] = useState(10);
  const [newOpCycleTime, setNewOpCycleTime] = useState('');

  const [showEditTargetModal, setShowEditTargetModal] = useState(false);
  const [editTargetCount, setEditTargetCount] = useState(10);
  const [editCycleTime, setEditCycleTime] = useState('');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [viewMode, setViewMode] = useState('blocks'); // 'blocks' | 'table'
  const [ruleMode, setRuleMode] = useState('rule1'); // 'rule1', 'rule2', 'rule3'
  const [showAddParamModal, setShowAddParamModal] = useState(false);
  const [editingParam, setEditingParam] = useState(null);
  const [paramForm, setParamForm] = useState({
    parameter_code: '',
    parameter_name: '',
    nominal_value: '10.00',
    upper_tolerance: '0.10',
    lower_tolerance: '-0.10',
    unit: 'mm',
    measurement_type: 'dimensional',
    is_critical: false,
    sequence_order: 1,
    voice_prompt: '',
    measurement_technique: '',
    sample_size: '',
    control_method: '',
  });

  // 1. Fetch Machines
  const loadMachines = useCallback(async () => {
    try {
      const res = await api.get('/api/machines/');
      const loaded = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      setMachines(loaded);
      if (loaded.length > 0 && !selectedMachine) {
        setSelectedMachine(loaded[0]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load machines.'));
    }
  }, [selectedMachine]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadMachines();
      setLoading(false);
    };
    init();
  }, []);

  // 2. Fetch Parts for Selected Machine strictly
  const loadPartsForMachine = useCallback(async () => {
    if (!selectedMachine) {
      setParts([]);
      setSelectedPart(null);
      return;
    }
    try {
      setError('');
      const res = await getParts(selectedMachine.id);
      const loaded = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      setParts(loaded);
      if (loaded.length > 0) {
        setSelectedPart(loaded[0]);
      } else {
        setSelectedPart(null);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load parts for selected machine.'));
    }
  }, [selectedMachine]);

  useEffect(() => {
    loadPartsForMachine();
  }, [loadPartsForMachine]);

  // 3. Fetch Operations (Templates) for Selected Part strictly
  const loadTemplates = useCallback(async () => {
    if (!selectedPart) {
      setTemplates([]);
      setSelectedTemplate(null);
      setParameters([]);
      return;
    }
    try {
      setError('');
      const res = await getPartTemplates(selectedPart.part_number);
      const loaded = res.data?.results ?? (Array.isArray(res.data) ? res.data : []);
      setTemplates(loaded);
      if (loaded.length > 0) {
        setSelectedTemplate(loaded[0]);
      } else {
        setSelectedTemplate(null);
        setParameters([]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load operations for selected part.'));
    }
  }, [selectedPart]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 4. Fetch Product & Process Parameters for Selected Operation (Template) strictly
  const [processParameters, setProcessParameters] = useState([]);
  const [showProcessParamModal, setShowProcessParamModal] = useState(false);
  const [editingProcessParam, setEditingProcessParam] = useState(null);
  const [processRuleMode, setProcessRuleMode] = useState('rule1'); // 'rule1', 'rule2', 'rule3'
  const [processParamForm, setProcessParamForm] = useState({
    parameter_code: '',
    parameter_name: '',
    nominal_value: '10.00',
    upper_tolerance: '0.10',
    lower_tolerance: '-0.10',
    unit: 'mm',
    data_type: 'numeric',
    measurement_type: 'dimensional',
    specification: '',
    is_required: true,
    is_active: true,
    sequence_order: 1,
    measurement_technique: 'VERNIER CALIPER',
    sample_size: '5NOS/SHIFT',
    control_method: '1st PIECE & INPROCESS INSP.',
  });

  const loadParameters = useCallback(async () => {
    if (!selectedTemplate) {
      setParameters([]);
      setProcessParameters([]);
      return;
    }
    try {
      setError('');
      const [resProd, resProc] = await Promise.all([
        getTemplateParameters(selectedTemplate.id),
        getProcessParameters(selectedTemplate.id),
      ]);
      const loadedProd = resProd.data?.results ?? (Array.isArray(resProd.data) ? resProd.data : []);
      const loadedProc = resProc.data?.results ?? (Array.isArray(resProc.data) ? resProc.data : []);
      setParameters(loadedProd);
      setProcessParameters(loadedProc);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load parameters for operation.'));
    }
  }, [selectedTemplate]);

  useEffect(() => {
    loadParameters();
  }, [loadParameters]);

  // MACHINE HANDLERS
  const handleOpenAddMachine = () => {
    setEditingMachine(null);
    setMachineForm({ machine_code: '', name: '', machine_type: 'CNC' });
    setShowAddMachineModal(true);
  };

  const handleOpenEditMachine = (m) => {
    setEditingMachine(m);
    setMachineForm({ machine_code: m.machine_code, name: m.name || '', machine_type: m.machine_type || 'CNC' });
    setShowAddMachineModal(true);
  };

  const handleSaveMachine = async (e) => {
    e.preventDefault();
    if (!machineForm.machine_code.trim()) return;
    try {
      setError('');
      setSuccessMsg('');
      if (editingMachine) {
        const res = await api.put(`/api/machines/${editingMachine.id}/`, {
          machine_code: machineForm.machine_code.trim().toUpperCase(),
          name: machineForm.name.trim() || `Machine ${machineForm.machine_code.trim()}`,
          machine_type: machineForm.machine_type,
          status: 'active',
        });
        setSuccessMsg(`Machine ${res.data.machine_code} updated!`);
        setSelectedMachine(res.data);
      } else {
        const res = await api.post('/api/machines/', {
          machine_code: machineForm.machine_code.trim().toUpperCase(),
          name: machineForm.name.trim() || `Machine ${machineForm.machine_code.trim()}`,
          machine_type: machineForm.machine_type,
          status: 'active',
        });
        setSuccessMsg(`Machine ${res.data.machine_code} created!`);
        setSelectedMachine(res.data);
      }
      setShowAddMachineModal(false);
      await loadMachines();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save machine.'));
    }
  };

  const handleDeleteMachine = async (mId) => {
    if (!window.confirm('Are you sure you want to delete this Machine and all associated Parts?')) return;
    try {
      setError('');
      await api.delete(`/api/machines/${mId}/`);
      setSuccessMsg('Machine deleted.');
      setSelectedMachine(null);
      await loadMachines();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete machine.'));
    }
  };

  // PART HANDLERS
  const handleOpenAddPart = () => {
    if (!selectedMachine) {
      setError('Please select or create a machine first.');
      return;
    }
    setEditingPart(null);
    setPartForm({ part_number: '', part_name: '', drawing_number: '', revision: 'A', description: '' });
    setShowAddPartModal(true);
  };

  const handleOpenEditPart = (p) => {
    setEditingPart(p);
    setPartForm({
      part_number: p.part_number,
      part_name: p.part_name,
      drawing_number: p.drawing_number || '',
      revision: p.revision || 'A',
      description: p.description || '',
    });
    setShowAddPartModal(true);
  };

  const handleSavePart = async (e) => {
    e.preventDefault();
    if (!selectedMachine) return;
    try {
      setError('');
      setSuccessMsg('');
      const cleanPartNum = partForm.part_number.trim().replace(/[\/#]+$/, '');
      const payload = { ...partForm, part_number: cleanPartNum, machine: selectedMachine.id };
      if (editingPart) {
        const res = await updatePart(editingPart.part_number, payload);
        setSuccessMsg(`Part ${res.data.part_number} updated!`);
        setSelectedPart(res.data);
      } else {
        const res = await createPart(payload);
        setSuccessMsg(`Part ${res.data.part_number} created for machine ${selectedMachine.machine_code}!`);
        setSelectedPart(res.data);
      }
      setShowAddPartModal(false);
      await loadPartsForMachine();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save part.'));
    }
  };

  const handleDeletePartItem = async (partNum) => {
    if (!window.confirm(`Are you sure you want to delete Part ${partNum} and all its operations & parameters?`)) return;
    try {
      setError('');
      await deletePart(partNum);
      setSuccessMsg(`Part ${partNum} deleted.`);
      setSelectedPart(null);
      await loadPartsForMachine();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete part.'));
    }
  };

  // OPERATION HANDLERS
  const handleSaveOperation = async (e) => {
    e.preventDefault();
    if (!selectedPart) return;
    try {
      setError('');
      setSuccessMsg('');
      const targetCount = parseInt(newOpTargetCount) || 10;
      const opTitle = newOpName.trim() || `${newOpType.replace('_', ' ').toUpperCase()} Sheet`;
      const res = await createTemplate(selectedPart.part_number, {
        name: opTitle,
        inspection_type: newOpType,
        target_parameter_count: targetCount,
        cycle_time_mins: parseFloat(newOpCycleTime) || 0.0,
        is_active: true
      });
      setSuccessMsg(`Operation "${opTitle}" created with target of ${targetCount} parameters!`);
      setShowAddOpModal(false);
      setNewOpName('');
      setNewOpCycleTime('');
      await loadTemplates();
      if (res.data?.id) setSelectedTemplate(res.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to add operation.'));
    }
  };

  const handleSaveTargetCount = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      setError('');
      setSuccessMsg('');
      const targetVal = parseInt(editTargetCount) || 10;
      const cycleVal = parseFloat(editCycleTime) || 0.0;
      const res = await updateTemplate(selectedTemplate.id, { 
        target_parameter_count: targetVal,
        cycle_time_mins: cycleVal
      });
      setSelectedTemplate(res.data);
      setSuccessMsg(`Target parameter count updated to ${targetVal} for this operation!`);
      setShowEditTargetModal(false);
      await loadTemplates();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to update target parameters count.'));
    }
  };

  const handlePublishTemplate = async () => {
    if (!selectedTemplate) return;
    setIsPublishing(true);
    try {
      setError('');
      setSuccessMsg('');
      const res = await publishTemplate(selectedTemplate.id);
      setSuccessMsg(res.data?.message || 'Operation published & dispatched to mobile apps successfully!');
      setSelectedTemplate((prev) => ({
        ...prev,
        is_published: true,
        published_at: res.data?.published_at || new Date().toISOString(),
      }));
      setShowPublishModal(false);
      await loadTemplates();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to publish template to mobile.'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteOperationItem = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this Operation and all its parameters?')) return;
    try {
      setError('');
      await deleteTemplate(templateId);
      setSuccessMsg('Operation deleted.');
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete operation.'));
    }
  };

  const selectRuleMode = (mode) => {
    setRuleMode(mode);
    if (mode === 'rule2') {
      setParamForm(prev => ({
        ...prev,
        measurement_type: 'visual',
        unit: 'Pass',
        nominal_value: '1.00',
        upper_tolerance: '0.00',
        lower_tolerance: '0.00',
      }));
    } else if (mode === 'rule3') {
      setParamForm(prev => ({
        ...prev,
        measurement_type: 'max_limit',
        unit: prev.unit === 'Pass' ? 'mm' : prev.unit,
        nominal_value: prev.nominal_value || '1.60',
        upper_tolerance: '0.00',
        lower_tolerance: '0.00',
      }));
    } else {
      setParamForm(prev => ({
        ...prev,
        measurement_type: 'dimensional',
        unit: prev.unit === 'Pass' ? 'mm' : prev.unit,
        nominal_value: prev.nominal_value || '10.00',
        upper_tolerance: '0.10',
        lower_tolerance: '-0.10',
      }));
    }
  };

  const handleOpenAddParam = () => {
    setEditingParam(null);
    setRuleMode('rule1');
    setParamForm({
      parameter_code: `P${parameters.length + 1}`,
      parameter_name: '',
      nominal_value: '10.00',
      upper_tolerance: '0.10',
      lower_tolerance: '-0.10',
      unit: 'mm',
      measurement_type: 'dimensional',
      is_critical: false,
      sequence_order: parameters.length + 1,
      measurement_technique: 'VERNIER CALIPER',
      sample_size: '5NOS/SHIFT',
      control_method: '1st PIECE & INPROCESS INSP.',
      voice_prompt: '',
    });
    setShowAddParamModal(true);
  };

  const handleOpenEditParam = (param) => {
    setEditingParam(param);
    let mode = 'rule1';
    const mType = (param.measurement_type || '').toLowerCase();
    if (mType === 'visual') mode = 'rule2';
    else if (['surface', 'min_limit', 'max_limit'].includes(mType)) mode = 'rule3';
    setRuleMode(mode);

    setParamForm({
      parameter_code: param.parameter_code,
      parameter_name: param.parameter_name,
      nominal_value: param.nominal_value,
      upper_tolerance: param.upper_tolerance,
      lower_tolerance: param.lower_tolerance,
      unit: param.unit,
      measurement_type: param.measurement_type,
      is_critical: param.is_critical,
      sequence_order: param.sequence_order,
      measurement_technique: param.measurement_technique || '',
      sample_size: param.sample_size || '',
      control_method: param.control_method || '',
      voice_prompt: param.voice_prompt || '',
    });
    setShowAddParamModal(true);
  };

  const handleSaveParam = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      setError('');
      setSuccessMsg('');
      const nominal = parseFloat(paramForm.nominal_value) || 0;
      const upperT = Math.abs(parseFloat(paramForm.upper_tolerance) || 0);
      const rawLower = parseFloat(paramForm.lower_tolerance) || 0;
      const lowerT = rawLower > 0 ? -rawLower : rawLower;

      const seqOrder = editingParam ? (editingParam.sequence_order || 1) : (parameters.length + 1);
      const autoCode = `P${seqOrder}`;

      const payload = {
        ...paramForm,
        parameter_code: autoCode,
        sequence_order: seqOrder,
        nominal_value: nominal,
        upper_tolerance: upperT,
        lower_tolerance: lowerT,
      };

      if (editingParam) {
        await updateParameter(editingParam.id, payload);
        setSuccessMsg(`Parameter #${seqOrder} updated!`);
      } else {
        await createParameter(selectedTemplate.id, payload);
        setSuccessMsg(`Parameter #${seqOrder} added sequentially!`);
      }
      setShowAddParamModal(false);
      loadParameters();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save parameter.'));
    }
  };

  const handleDeleteParam = async (paramId) => {
    if (!window.confirm('Are you sure you want to delete this parameter?')) return;
    try {
      setError('');
      await deleteParameter(paramId);
      setSuccessMsg('Parameter deleted.');
      await loadParameters();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete parameter.'));
    }
  };

  const selectProcessRuleMode = (mode) => {
    setProcessRuleMode(mode);
    if (mode === 'rule2') {
      setProcessParamForm(prev => ({
        ...prev,
        measurement_type: 'visual',
        unit: 'Pass',
        nominal_value: '1.00',
        upper_tolerance: '0.00',
        lower_tolerance: '0.00',
      }));
    } else if (mode === 'rule3') {
      setProcessParamForm(prev => ({
        ...prev,
        measurement_type: 'max_limit',
        unit: prev.unit === 'Pass' ? 'mm' : prev.unit,
        nominal_value: prev.nominal_value || '1.60',
        upper_tolerance: '0.00',
        lower_tolerance: '0.00',
      }));
    } else {
      setProcessParamForm(prev => ({
        ...prev,
        measurement_type: 'dimensional',
        unit: prev.unit === 'Pass' ? 'mm' : prev.unit,
        nominal_value: prev.nominal_value || '10.00',
        upper_tolerance: '0.10',
        lower_tolerance: '-0.10',
      }));
    }
  };

  const handleOpenAddProcessParam = () => {
    setEditingProcessParam(null);
    setProcessRuleMode('rule1');
    setProcessParamForm({
      parameter_code: `PR${processParameters.length + 1}`,
      parameter_name: '',
      nominal_value: '10.00',
      upper_tolerance: '0.10',
      lower_tolerance: '-0.10',
      unit: 'mm',
      data_type: 'numeric',
      measurement_type: 'dimensional',
      specification: '',
      is_required: true,
      is_active: true,
      sequence_order: processParameters.length + 1,
      measurement_technique: 'VERNIER CALIPER',
      sample_size: '5NOS/SHIFT',
      control_method: '1st PIECE & INPROCESS INSP.',
    });
    setShowProcessParamModal(true);
  };

  const handleOpenEditProcessParam = (pp) => {
    setEditingProcessParam(pp);
    let mode = 'rule1';
    const mType = (pp.measurement_type || '').toLowerCase();
    if (mType === 'visual') mode = 'rule2';
    else if (['surface', 'min_limit', 'max_limit'].includes(mType)) mode = 'rule3';
    setProcessRuleMode(mode);

    setProcessParamForm({
      parameter_code: pp.parameter_code || '',
      parameter_name: pp.parameter_name || '',
      data_type: pp.data_type || 'numeric',
      nominal_value: pp.nominal_value ?? '10.00',
      upper_tolerance: pp.upper_tolerance ?? '0.10',
      lower_tolerance: pp.lower_tolerance ?? '-0.10',
      unit: pp.unit || 'mm',
      measurement_type: pp.measurement_type || 'dimensional',
      specification: pp.specification || '',
      is_required: pp.is_required !== false,
      is_active: pp.is_active !== false,
      sequence_order: pp.sequence_order || 1,
      measurement_technique: pp.measurement_technique || '',
      sample_size: pp.sample_size || '',
      control_method: pp.control_method || '',
    });
    setShowProcessParamModal(true);
  };

  const handleSaveProcessParam = async (e) => {
    e.preventDefault();
    if (!selectedTemplate || !processParamForm.parameter_name.trim()) return;
    try {
      setError('');
      setSuccessMsg('');
      const nominal = parseFloat(processParamForm.nominal_value) || 0;
      const upperT = Math.abs(parseFloat(processParamForm.upper_tolerance) || 0);
      const rawLower = parseFloat(processParamForm.lower_tolerance) || 0;
      const lowerT = rawLower > 0 ? -rawLower : rawLower;

      const seqOrder = editingProcessParam ? (editingProcessParam.sequence_order || 1) : (processParameters.length + 1);

      const payload = {
        template: selectedTemplate.id,
        parameter_name: processParamForm.parameter_name.trim(),
        parameter_code: processParamForm.parameter_code.trim() || `PR${seqOrder}`,
        data_type: processParamForm.data_type,
        measurement_type: processParamForm.measurement_type || 'dimensional',
        unit: processParamForm.unit.trim(),
        specification: processParamForm.specification.trim(),
        nominal_value: nominal,
        upper_tolerance: upperT,
        lower_tolerance: lowerT,
        is_required: processParamForm.is_required,
        is_active: processParamForm.is_active,
        sequence_order: seqOrder,
        measurement_technique: processParamForm.measurement_technique || '',
        sample_size: processParamForm.sample_size || '',
        control_method: processParamForm.control_method || '',
      };

      if (editingProcessParam) {
        await updateProcessParameter(editingProcessParam.id, payload);
        setSuccessMsg(`Process Parameter "${payload.parameter_name}" updated!`);
      } else {
        await createProcessParameter(selectedTemplate.id, payload);
        setSuccessMsg(`Process Parameter "${payload.parameter_name}" created!`);
      }
      setShowProcessParamModal(false);
      await loadParameters();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save process parameter.'));
    }
  };

  const handleDeleteProcessParam = async (pp) => {
    if (!window.confirm(`Delete process parameter "${pp.parameter_name}"?`)) return;
    try {
      setError('');
      setSuccessMsg('');
      await deleteProcessParameter(pp.id);
      setSuccessMsg(`Process Parameter "${pp.parameter_name}" deleted.`);
      await loadParameters();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete process parameter.'));
    }
  };

  if (loading) return <LoadingSpinner message="Loading Master Database..." />;

  const nom = parseFloat(paramForm.nominal_value) || 0;
  const upperT = parseFloat(paramForm.upper_tolerance) || 0;
  const lowerT = parseFloat(paramForm.lower_tolerance) || 0;

  return (
    <>
      <Header
        title="Master Database Builder"
        subtitle="Supervisor Manual Configuration: Machine → Part → Operation → Parameters (P1, P2...)"
      />

      <div className="page-content bg-gradient-animated" style={{ padding: '24px', background: '#F1F5F9', minHeight: '100vh' }}>

        {/* ── TOP PAGE HEADER BAR ─────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14, padding: '16px 24px', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
              Factory Master Registry
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Master Database & Inspection Parameters Configuration
            </div>
          </div>
          <span style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            color: '#15803D', fontSize: 11, fontWeight: 700, padding: '5px 14px',
            borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase'
          }}>
            Supervisor Access
          </span>
        </div>

        {/* ── ALERTS ──────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            color: '#B91C1C', padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>{error}</span>
            <button style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: 18 }} onClick={() => setError('')}>×</button>
          </div>
        )}
        {successMsg && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            color: '#15803D', padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>{successMsg}</span>
            <button style={{ background: 'none', border: 'none', color: '#15803D', cursor: 'pointer', fontSize: 18 }} onClick={() => setSuccessMsg('')}>×</button>
          </div>
        )}

        {/* ── 1. CONFIGURATION (HIERARCHY SELECTORS) ───────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0', borderRadius: 14, padding: '20px 24px',
          marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>
            CONFIGURATION HIERARCHY
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
            Select Machine → Part → Operation to view and manage parameters.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* STEP 1 — MACHINE */}
            <div style={{ background: '#F8FAFC', border: '1.5px solid #BAE6FD', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  STEP 1 — MACHINE
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {selectedMachine && (
                    <>
                      <button style={{ padding: '2px 8px', fontSize: 11, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, color: '#475569', cursor: 'pointer' }} onClick={() => handleOpenEditMachine(selectedMachine)}>Edit</button>
                      <button style={{ padding: '2px 8px', fontSize: 11, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', cursor: 'pointer' }} onClick={() => handleDeleteMachine(selectedMachine.id)}>Delete</button>
                    </>
                  )}
                  <button style={{ padding: '2px 8px', fontSize: 11, background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: 6, color: '#0284C7', cursor: 'pointer', fontWeight: 700 }} onClick={handleOpenAddMachine}>+ New</button>
                </div>
              </div>
              <select
                style={{
                  width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1',
                  borderRadius: 8, padding: '9px 12px', color: '#1E293B',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none'
                }}
                value={selectedMachine?.id || ''}
                onChange={(e) => { const m = machines.find((mach) => mach.id === parseInt(e.target.value)); setSelectedMachine(m); }}
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.machine_code} — {m.name}</option>
                ))}
              </select>
            </div>

            {/* STEP 2 — PART */}
            <div style={{ background: '#F8FAFC', border: '1.5px solid #E9D5FF', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  STEP 2 — PART {selectedMachine ? `[${selectedMachine.machine_code}]` : ''}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {selectedPart && (
                    <>
                      <button style={{ padding: '2px 8px', fontSize: 11, background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, color: '#475569', cursor: 'pointer' }} onClick={() => handleOpenEditPart(selectedPart)}>Edit</button>
                      <button style={{ padding: '2px 8px', fontSize: 11, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', cursor: 'pointer' }} onClick={() => handleDeletePartItem(selectedPart.part_number)}>Delete</button>
                    </>
                  )}
                  <button style={{ padding: '2px 8px', fontSize: 11, background: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 6, color: '#7C3AED', cursor: 'pointer', fontWeight: 700 }} onClick={handleOpenAddPart}>+ New</button>
                </div>
              </div>
              {parts.length > 0 ? (
                <select
                  style={{
                    width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1',
                    borderRadius: 8, padding: '9px 12px', color: '#1E293B',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none'
                  }}
                  value={selectedPart?.part_number || ''}
                  onChange={(e) => { const p = parts.find((pt) => pt.part_number === e.target.value); setSelectedPart(p); }}
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.part_number}>{p.part_number} — {p.part_name}</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: 12, color: '#D97706', paddingTop: 8 }}>No parts for this machine. Click "+ New".</div>
              )}
            </div>

            {/* STEP 3 — OPERATION */}
            <div style={{ background: '#F8FAFC', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  STEP 3 — OPERATION {selectedPart ? `[${selectedPart.part_number}]` : ''}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {selectedTemplate && (
                    <button style={{ padding: '2px 8px', fontSize: 11, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', cursor: 'pointer' }} onClick={() => handleDeleteOperationItem(selectedTemplate.id)}>Delete</button>
                  )}
                  {selectedPart && (
                    <button style={{ padding: '2px 8px', fontSize: 11, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, color: '#059669', cursor: 'pointer', fontWeight: 700 }} onClick={() => setShowAddOpModal(true)}>+ New</button>
                  )}
                </div>
              </div>
              {templates.length > 0 ? (
                <select
                  style={{
                    width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1',
                    borderRadius: 8, padding: '9px 12px', color: '#1E293B',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none'
                  }}
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => { const t = templates.find((tmpl) => tmpl.id === parseInt(e.target.value)); setSelectedTemplate(t); }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name ? t.name : t.inspection_type.toUpperCase()} (v{t.version})</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: 12, color: '#D97706', paddingTop: 8 }}>
                  {selectedPart ? 'No operations. Click "+ New"' : 'Select a Part first'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. INSPECTION PARAMETERS SECTION ────────────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0', borderRadius: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
          marginBottom: 24
        }}>

          {/* Section Header & Path Breadcrumb */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 14, padding: '18px 24px',
            borderBottom: '1px solid #F1F5F9', background: '#FAFBFC'
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px', marginBottom: 6 }}>
                Inspection Parameters
              </div>
              {selectedTemplate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: '#EFF6FF', border: '1px solid #BAE6FD', color: '#0284C7', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {selectedMachine?.machine_code}
                  </span>
                  <span style={{ color: '#CBD5E1', fontSize: 14 }}>›</span>
                  <span style={{ background: '#F5F3FF', border: '1px solid #E9D5FF', color: '#7C3AED', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {selectedPart?.part_number}
                  </span>
                  <span style={{ color: '#CBD5E1', fontSize: 14 }}>›</span>
                  <span style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {selectedTemplate?.name || selectedTemplate?.inspection_type.toUpperCase()}
                  </span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Select Machine → Part → Operation above to manage parameters.</p>
              )}
            </div>

            {/* Right Side: Single Dynamic Action Button & View Switcher */}
            {selectedTemplate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* View Mode Switcher */}
                {((activeParamTab === 'product' && parameters.length > 0) || (activeParamTab === 'process' && processParameters.length > 0)) && (
                  <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, border: '1px solid #CBD5E1', gap: 2 }}>
                    <button
                      onClick={() => setViewMode('blocks')}
                      style={{
                        padding: '5px 11px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none',
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: viewMode === 'blocks' ? '#0F172A' : 'transparent',
                        color: viewMode === 'blocks' ? '#FFFFFF' : '#64748B',
                      }}
                    >⊞ Blocks</button>
                    <button
                      onClick={() => setViewMode('table')}
                      style={{
                        padding: '5px 11px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none',
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: viewMode === 'table' ? '#0F172A' : 'transparent',
                        color: viewMode === 'table' ? '#FFFFFF' : '#64748B',
                      }}
                    >≡ Table</button>
                  </div>
                )}

                {/* SINGLE DYNAMIC ACTION BUTTON */}
                {activeParamTab === 'product' ? (
                  <>{isAdmin ? null : <button
                    onClick={handleOpenAddParam}
                    style={{
                      padding: '9px 18px', fontWeight: 700, borderRadius: 10, fontSize: 12.5,
                      background: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 100%)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span>📏 + Add Product Parameter</span>
                  </button>}</>
                ) : (
                  <>{isAdmin ? null : <button
                    onClick={handleOpenAddProcessParam}
                    style={{
                      padding: '9px 18px', fontWeight: 700, borderRadius: 10, fontSize: 12.5,
                      background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span>⚙️ + Add Process Parameter</span>
                  </button>}</>
                )}
              </div>
            )}
          </div>

          {/* TWO SEPARATED CATEGORY TABS (PRODUCT vs PROCESS ONLY) */}
          {selectedTemplate && (
            <div style={{
              display: 'flex', alignItems: 'center', padding: '12px 24px',
              background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', gap: 12
            }}>
              <button
                onClick={() => setActiveParamTab('product')}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: activeParamTab === 'product' ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
                  background: activeParamTab === 'product' ? '#EFF6FF' : '#FFFFFF',
                  color: activeParamTab === 'product' ? '#0284C7' : '#475569',
                  boxShadow: activeParamTab === 'product' ? '0 2px 6px rgba(2,132,199,0.15)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span>📏 Product Parameters</span>
                <span style={{ background: activeParamTab === 'product' ? '#0284C7' : '#94A3B8', color: '#FFF', padding: '1px 8px', borderRadius: 10, fontSize: 10 }}>
                  {parameters.length}
                </span>
              </button>

              <button
                onClick={() => setActiveParamTab('process')}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: activeParamTab === 'process' ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
                  background: activeParamTab === 'process' ? '#EEF2FF' : '#FFFFFF',
                  color: activeParamTab === 'process' ? '#4F46E5' : '#475569',
                  boxShadow: activeParamTab === 'process' ? '0 2px 6px rgba(79,70,229,0.15)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span>⚙️ Process Parameters</span>
                <span style={{ background: activeParamTab === 'process' ? '#4F46E5' : '#94A3B8', color: '#FFF', padding: '1px 8px', borderRadius: 10, fontSize: 10 }}>
                  {processParameters.length}
                </span>
              </button>
            </div>
          )}

          {/* PARAMETER CONTENT BODY */}
          {!selectedTemplate ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>No Operation Selected</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>Select Machine → Part → Operation in the Configuration section above.</div>
            </div>
          ) : activeParamTab === 'product' ? (
            /* ── A. PRODUCT PARAMETERS SECTION ──────────────────────── */
            <div>
              <div style={{ padding: '14px 24px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    PRODUCT PARAMETERS ({parameters.length})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Quality characteristics and product checks (Measurable dimensions & visual specs used for Hourly & Setup Inspections)
                  </div>
                </div>
              </div>

              {parameters.length === 0 ? (
                <div style={{ padding: '50px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>No Product Parameters Configured</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Click "+ Add Product Parameter" in the header toolbar above to define quality inspection rules.
                  </div>
                </div>
              ) : viewMode === 'blocks' ? (
                /* Block Grid */
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {parameters.map((p, i) => {
                      const mtype = (p.measurement_type || '').toLowerCase();
                      const isVisual = mtype === 'visual';
                      const isLimit  = mtype === 'max_limit' || mtype === 'min_limit' || mtype === 'surface';
                      const borderColor = isVisual ? '#059669' : isLimit ? '#D97706' : '#0284C7';
                      const ruleLabel  = isVisual ? 'Rule 2 — Visual YES/NO' : isLimit ? 'Rule 3 — Limit' : 'Rule 1 — Range';
                      const ruleTagBg  = isVisual ? '#F0FDF4' : isLimit ? '#FFFBEB' : '#EFF6FF';
                      const ruleTagColor = isVisual ? '#059669' : isLimit ? '#B45309' : '#0284C7';
                      const ruleTagBorder = isVisual ? '#BBF7D0' : isLimit ? '#FDE68A' : '#BAE6FD';

                      return (
                        <div key={p.id} style={{
                          background: '#FFFFFF',
                          border: `1px solid ${p.is_critical ? '#FECACA' : '#E2E8F0'}`,
                          borderLeft: `4px solid ${p.is_critical ? '#DC2626' : borderColor}`,
                          borderRadius: 12,
                          boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                          display: 'flex', flexDirection: 'column',
                          overflow: 'hidden',
                        }}>
                          {/* Card Header */}
                          <div style={{
                            padding: '13px 16px 10px',
                            background: p.is_critical ? '#FFF5F5' : '#FAFBFC',
                            borderBottom: '1px solid #F1F5F9',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: '#0F172A', color: '#FFFFFF',
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '0.4px'
                              }}>P{p.sequence_order || (i + 1)}</span>
                              <span style={{
                                background: ruleTagBg, color: ruleTagColor, border: `1px solid ${ruleTagBorder}`,
                                padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700
                              }}>{ruleLabel}</span>
                            </div>
                            {p.is_critical && (
                              <span style={{
                                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                                padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 800
                              }}>CRITICAL</span>
                            )}
                          </div>

                          {/* Card Body */}
                          <div style={{ padding: '14px 16px', flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 14, letterSpacing: '-0.2px' }}>
                              {p.parameter_name}
                            </div>

                            {!isVisual && (
                              <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 6, marginBottom: 10 }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Upper Tol</div>
                                    <div style={{
                                      background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: 8,
                                      padding: '8px 4px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0284C7'
                                    }}>+{p.upper_tolerance}</div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Nominal</div>
                                    <div style={{
                                      background: '#F8FAFC', border: '2px solid #CBD5E1', borderRadius: 8,
                                      padding: '8px 4px', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#0F172A'
                                    }}>{p.nominal_value} <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{p.unit}</span></div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Lower Tol</div>
                                    <div style={{
                                      background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: 8,
                                      padding: '8px 4px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0284C7'
                                    }}>{p.lower_tolerance}</div>
                                  </div>
                                </div>

                                <div style={{
                                  background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
                                  padding: '8px 12px', marginBottom: 12, textAlign: 'center',
                                  fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#059669'
                                }}>
                                  Allowed: {p.lower_limit} – {p.upper_limit} {p.unit}
                                </div>
                              </>
                            )}

                            {isVisual && (
                              <div style={{
                                background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
                                padding: '12px', marginBottom: 12, textAlign: 'center'
                              }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>VISUAL CHECK</div>
                                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Operator records PASS / FAIL</div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                                  <span style={{ background: '#059669', color: '#fff', padding: '3px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>YES = PASS</span>
                                  <span style={{ background: '#DC2626', color: '#fff', padding: '3px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>NO = FAIL</span>
                                </div>
                              </div>
                            )}

                            {isLimit && (
                              <div style={{
                                background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
                                padding: '10px 12px', marginBottom: 12, textAlign: 'center'
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>
                                  {mtype === 'min_limit' ? `≥ Minimum: ${p.nominal_value} ${p.unit}` : `≤ Maximum: ${p.nominal_value} ${p.unit}`}
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {p.measurement_technique && (
                                <span style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                                  {p.measurement_technique}
                                </span>
                              )}
                              {p.sample_size && (
                                <span style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                                  {p.sample_size}
                                </span>
                              )}
                              {p.control_method && (
                                <span style={{ background: '#F5F3FF', border: '1px solid #E9D5FF', color: '#7C3AED', padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                                  {p.control_method}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Footer — Actions */}
                          <div style={{
                            padding: '10px 16px', borderTop: '1px solid #F1F5F9',
                            display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFBFC'
                          }}>
                            <>{isAdmin ? null : <button
                              onClick={() => handleOpenEditParam(p)}
                              style={{
                                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                                background: '#EFF6FF', border: '1px solid #BAE6FD',
                                borderRadius: 7, color: '#0284C7', cursor: 'pointer'
                              }}
                            >Edit</button>}</>
                            <>{isAdmin ? null : <button
                              onClick={() => handleDeleteParam(p.id)}
                              style={{
                                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 7, color: '#DC2626', cursor: 'pointer'
                              }}
                            >Delete</button>}</>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Table View */
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        {['#', 'Parameter Name', 'Nominal', 'Tolerances', 'Allowed Range', 'Unit', 'Type', 'Status', 'Actions'].map((h) => (
                          <th key={h} style={{
                            padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                            color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.8px',
                            whiteSpace: 'nowrap'
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parameters.map((p) => (
                        <tr key={p.id} style={{
                          background: '#FFFFFF',
                          borderBottom: '1px solid #F1F5F9',
                        }}>
                          <td style={{ padding: '13px 16px', color: '#94A3B8', fontWeight: 700, fontSize: 13 }}>P{p.sequence_order}</td>
                          <td style={{ padding: '13px 16px', fontWeight: 700, color: '#0F172A', fontSize: 14, borderLeft: '3px solid #0284C7' }}>
                            {p.parameter_name}
                          </td>
                          <td style={{ padding: '13px 16px', fontWeight: 700, color: '#334155', fontFamily: 'monospace', fontSize: 13 }}>{p.nominal_value}</td>
                          <td style={{ padding: '13px 16px', color: '#0284C7', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>+{p.upper_tolerance} / {p.lower_tolerance}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {p.lower_limit} – {p.upper_limit} {p.unit}
                            </span>
                          </td>
                          <td style={{ padding: '13px 16px', color: '#64748B', fontWeight: 600, fontSize: 12 }}>{p.unit}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ background: '#EFF6FF', color: '#0284C7', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', border: '1px solid #BAE6FD' }}>
                              {p.measurement_type}
                            </span>
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            {p.is_critical
                              ? <span style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>CRITICAL</span>
                              : <span style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>Normal</span>}
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenEditParam(p)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#EFF6FF', border: '1px solid #BAE6FD', borderRadius: 7, color: '#0284C7', cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => handleDeleteParam(p.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, color: '#DC2626', cursor: 'pointer' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── B. PROCESS PARAMETERS SECTION ──────────────────────── */
            <div>
              <div style={{ padding: '14px 24px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#312E81', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    PROCESS PARAMETERS ({processParameters.length})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Setup-only parameters checked by Inspector for 1PC#1, 1PC#2, and 1PC#3 (NOT for hourly inspection)
                  </div>
                </div>
              </div>

              {processParameters.length === 0 ? (
                <div style={{ padding: '50px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>No Process Parameters Configured</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Click "+ Add Process Parameter" in the header toolbar above to configure machine setup checks (RPM, Feed, Tool Offset, Coolant, etc.).
                  </div>
                </div>
              ) : viewMode === 'blocks' ? (
                /* Block Grid View for Process Parameters */
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {processParameters.map((pp) => {
                      const isNumeric = (pp.data_type || '').toLowerCase() === 'numeric';
                      const hasLimits = pp.lower_limit != null && pp.upper_limit != null;

                      return (
                        <div key={pp.id} style={{
                          background: '#FFFFFF',
                          border: '1px solid #C7D2FE',
                          borderLeft: '4px solid #4F46E5',
                          borderRadius: 12,
                          boxShadow: '0 2px 8px rgba(79,70,229,0.06)',
                          display: 'flex', flexDirection: 'column',
                          overflow: 'hidden',
                        }}>
                          {/* Card Header */}
                          <div style={{
                            padding: '13px 16px 10px',
                            background: '#EEF2FF',
                            borderBottom: '1px solid #E0E7FF',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: '#4338CA', color: '#FFFFFF',
                                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, fontFamily: 'monospace'
                              }}>{pp.parameter_code}</span>
                              <span style={{
                                background: '#E0E7FF', color: '#4338CA', border: '1px solid #C7D2FE',
                                padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase'
                              }}>{pp.data_type || 'NUMERIC'}</span>
                            </div>
                            <span style={{
                              background: '#F5F3FF', color: '#7C3AED', border: '1px solid #E9D5FF',
                              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700
                            }}>1PC SETUP ONLY</span>
                          </div>

                          {/* Card Body */}
                          <div style={{ padding: '14px 16px', flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 12, letterSpacing: '-0.2px' }}>
                              {pp.parameter_name}
                            </div>

                            {/* Specification / Expected Box */}
                            <div style={{
                              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                              padding: '10px 12px', marginBottom: 10
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 2 }}>
                                Expected Spec / Value
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#1E1B4B', fontFamily: 'monospace' }}>
                                {pp.specification || '—'} {pp.unit ? <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{pp.unit}</span> : ''}
                              </div>
                            </div>

                            {/* Range / Allowed Limits Pill */}
                            {isNumeric && hasLimits && (
                              <div style={{
                                background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
                                padding: '8px 12px', marginBottom: 10, textAlign: 'center',
                                fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#059669'
                              }}>
                                Allowed Range: {pp.lower_limit} – {pp.upper_limit} {pp.unit || ''}
                              </div>
                            )}

                            {/* Info Tag */}
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                                Inspector Check (1PC#1, #2, #3)
                              </span>
                            </div>
                          </div>

                          {/* Card Footer — Actions */}
                          <div style={{
                            padding: '10px 16px', borderTop: '1px solid #F1F5F9',
                            display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFBFC'
                          }}>
                            <>{isAdmin ? null : <button
                              onClick={() => handleOpenEditProcessParam(pp)}
                              style={{
                                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                                background: '#EEF2FF', border: '1px solid #C7D2FE',
                                borderRadius: 7, color: '#4338CA', cursor: 'pointer'
                              }}
                            >Edit</button>}</>
                            <>{isAdmin ? null : <button
                              onClick={() => handleDeleteProcessParam(pp)}
                              style={{
                                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 7, color: '#DC2626', cursor: 'pointer'
                              }}
                            >Delete</button>}</>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Table View */
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>CODE</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>PROCESS PARAMETER NAME</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>DATA TYPE</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>UNIT</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>SPECIFICATION / EXPECTED</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#475569' }}>RANGE / LIMITS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#475569' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processParameters.map((pp, i) => (
                        <tr key={pp.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: '#4338CA', fontSize: 13, fontFamily: 'monospace' }}>{pp.parameter_code}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A', fontSize: 13.5 }}>{pp.parameter_name}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                              {pp.data_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontSize: 12, fontWeight: 600 }}>{pp.unit || '—'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B', fontSize: 13 }}>{pp.specification || '—'}</td>
                          <td style={{ padding: '12px 16px', color: '#059669', fontFamily: 'monospace', fontSize: 12.5, fontWeight: 600 }}>
                            {pp.data_type === 'numeric' && pp.lower_limit != null && pp.upper_limit != null
                              ? `${pp.lower_limit} – ${pp.upper_limit} ${pp.unit}`
                              : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenEditProcessParam(pp)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 7, color: '#4338CA', cursor: 'pointer' }}>Edit</button>
                              <button onClick={() => handleDeleteProcessParam(pp)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, color: '#DC2626', cursor: 'pointer' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ── 3. CONFIGURATION STATUS CARD ────────────────────────── */}
        {selectedTemplate && (() => {
          const target = selectedTemplate?.target_parameter_count || 10;
          const current = parameters.length;
          const pct = Math.min(Math.round((current / target) * 100), 100);
          const complete = current >= target;

          return (
            <div style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
              padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
                    CONFIGURATION STATUS
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: complete ? '#059669' : '#0284C7' }}>
                    {current} / {target} Parameters Configured ({pct}%)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {complete ? (
                    <span style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                      Complete
                    </span>
                  ) : (
                    <span style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                      In Progress
                    </span>
                  )}
                  <button
                    onClick={() => { setEditTargetCount(target); setEditCycleTime(selectedTemplate?.cycle_time_mins || ''); setShowEditTargetModal(true); }}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 700,
                      background: '#EFF6FF', border: '1px solid #BAE6FD',
                      borderRadius: 8, color: '#0284C7', cursor: 'pointer'
                    }}
                  >
                    Edit Target ({target})
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', height: 8, background: '#E2E8F0', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%', borderRadius: 20,
                  background: complete
                    ? 'linear-gradient(90deg, #059669, #34D399)'
                    : 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: complete ? '0 0 8px rgba(5,150,105,0.3)' : '0 0 8px rgba(2,132,199,0.3)'
                }} />
              </div>
            </div>
          );
        })()}

        {/* ── 4. MOBILE DEPLOYMENT CARD ──────────────────────────── */}
        {selectedTemplate && (() => {
          const current = parameters.length;
          const isPublished = selectedTemplate?.is_published;

          return (
            <div style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14,
              padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                MOBILE DEPLOYMENT
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderRadius: 12, flexWrap: 'wrap', gap: 14,
                background: isPublished ? '#F0FDF4' : '#EFF6FF',
                border: `1px solid ${isPublished ? '#86EFAC' : '#93C5FD'}`,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isPublished ? '#15803D' : '#1E40AF' }}>
                      Status: {isPublished ? 'Dispatched & Live' : 'Ready to Dispatch'}
                    </span>
                    <span style={{
                      padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: isPublished ? '#DCFCE7' : '#DBEAFE',
                      color: isPublished ? '#16A34A' : '#2563EB',
                      border: `1px solid ${isPublished ? '#BBF7D0' : '#BFDBFE'}`
                    }}>
                      {selectedMachine?.machine_code || 'CNC-01'} · Operator & Quality Inspector
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: isPublished ? '#166534' : '#3B82F6', marginTop: 4 }}>
                    {isPublished
                      ? `All configured parameters are active on shop floor mobile devices for ${selectedPart?.part_number}.`
                      : `Click Dispatch to broadcast configured parameters to shop floor mobile devices.`}
                  </div>
                </div>

                <button
                  onClick={() => setShowPublishModal(true)}
                  style={{
                    padding: '9px 20px', fontWeight: 800, borderRadius: 10, fontSize: 13,
                    background: isPublished
                      ? 'linear-gradient(135deg, #15803D 0%, #16A34A 100%)'
                      : 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: isPublished ? '0 3px 10px rgba(22,163,74,0.3)' : '0 3px 10px rgba(37,99,235,0.3)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span>{isPublished ? 'Re-Dispatch to Mobile' : 'Publish & Dispatch to Mobile'}</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Modal 1: Add / Edit Machine */}
        {showAddMachineModal && (
          <div className="modal-overlay" onClick={() => setShowAddMachineModal(false)}>
            <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingMachine ? `Edit Machine: ${editingMachine.machine_code}` : 'Add New Machine'}</h3>
                <button type="button" className="btn-close" onClick={() => setShowAddMachineModal(false)}>×</button>
              </div>
              <form onSubmit={handleSaveMachine}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label">Machine Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CNC-01, VMC-02"
                      value={machineForm.machine_code}
                      onChange={(e) => setMachineForm({ ...machineForm, machine_code: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Machine Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CNC Turning Center"
                      value={machineForm.name}
                      onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddMachineModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingMachine ? 'Update Machine' : 'Save Machine'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Add / Edit Part */}
        {showAddPartModal && selectedMachine && (
          <div className="modal-overlay" onClick={() => setShowAddPartModal(false)}>
            <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingPart ? `Edit Part: ${editingPart.part_number}` : `Add Part to Machine [${selectedMachine.machine_code}]`}</h3>
                <button type="button" className="btn-close" onClick={() => setShowAddPartModal(false)}>×</button>
              </div>
              <form onSubmit={handleSavePart}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label">Part Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. PN-99001"
                      value={partForm.part_number}
                      onChange={(e) => setPartForm({ ...partForm, part_number: e.target.value })}
                      required
                      disabled={!!editingPart}
                    />
                  </div>
                  <div>
                    <label className="form-label">Part Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Drive Shaft Pulley"
                      value={partForm.part_name}
                      onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Drawing No</label>
                      <input
                        type="text"
                        className="form-input"
                        value={partForm.drawing_number}
                        onChange={(e) => setPartForm({ ...partForm, drawing_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Revision</label>
                      <input
                        type="text"
                        className="form-input"
                        value={partForm.revision}
                        onChange={(e) => setPartForm({ ...partForm, revision: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddPartModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingPart ? 'Update Part' : 'Save Part'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Add Operation */}
        {showAddOpModal && selectedPart && (
          <div className="modal-overlay" onClick={() => setShowAddOpModal(false)}>
            <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Add Operation Stage for [{selectedPart.part_number}]</h3>
                <button type="button" className="btn-close" onClick={() => setShowAddOpModal(false)}>×</button>
              </div>
              <form onSubmit={handleSaveOperation}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold' }}>
                      Operation Name / Process Title *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Op 10 - Rough Turning, Op 20 - Finish Grooving"
                      value={newOpName}
                      onChange={(e) => setNewOpName(e.target.value)}
                      required
                    />
                    
                    {/* Preset Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>Presets:</span>
                      {['Op 10 - Rough Turning', 'Op 20 - Finish Grooving', 'Op 30 - Drilling & Milling', 'Op 40 - Balancing Check', 'Op 50 - Final Quality Check'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', fontSize: 11, background: '#1E293B', border: '1px solid #334155', color: '#38BDF8' }}
                          onClick={() => setNewOpName(preset)}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Inspection Category Sheet</label>
                    <select className="form-select" value={newOpType} onChange={(e) => setNewOpType(e.target.value)}>
                      <option value="first_piece">First Piece Sheet (Oper 10)</option>
                      <option value="hourly">Hourly In-Process Sheet (Oper 20)</option>
                      <option value="final">Final Quality Check Sheet (Oper 30)</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold' }}>
                      Target Parameters Count (e.g. 18, 10, 4) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="form-input"
                      value={newOpTargetCount}
                      onChange={(e) => setNewOpTargetCount(parseInt(e.target.value) || 1)}
                      required
                    />
                    <small style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, display: 'block' }}>
                      Set expected parameter count for this operation (e.g. 18 parameters for full check).
                    </small>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold' }}>
                      Cycle Time (Minutes)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-input"
                      value={newOpCycleTime}
                      onChange={(e) => setNewOpCycleTime(e.target.value)}
                    />
                    <small style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, display: 'block' }}>
                      Time taken for one operation cycle in minutes.
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddOpModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Operation</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Add / Edit Parameter */}
        {showAddParamModal && selectedTemplate && (
          <div className="modal-overlay" onClick={() => setShowAddParamModal(false)}>
            <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingParam ? `Edit Parameter Rule` : `Add Parameter Rule to [${selectedTemplate?.inspection_type?.toUpperCase()}]`}</h3>
                <button type="button" className="btn-close" onClick={() => setShowAddParamModal(false)}>×</button>
              </div>
              <form onSubmit={handleSaveParam}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* 3 SPECIFICATION RULES SELECTOR */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold', marginBottom: 6, display: 'block' }}>
                      Select Quality Inspection Rule *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${ruleMode === 'rule1' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: ruleMode === 'rule1' ? '2px solid #38BDF8' : '1px solid #334155' }}
                        onClick={() => selectRuleMode('rule1')}
                      >
                        Rule 1: Range (&gt; Limit &lt;)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${ruleMode === 'rule2' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: ruleMode === 'rule2' ? '2px solid #10B981' : '1px solid #334155' }}
                        onClick={() => selectRuleMode('rule2')}
                      >
                        Rule 2: Visual (YES/NO)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${ruleMode === 'rule3' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: ruleMode === 'rule3' ? '2px solid #F59E0B' : '1px solid #334155' }}
                        onClick={() => selectRuleMode('rule3')}
                      >
                        Rule 3: Limit (&le; or &ge;)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Parameter Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={
                        ruleMode === 'rule1' ? 'e.g. Bore Diameter, Total Length' :
                        ruleMode === 'rule2' ? 'e.g. Chamfer & Deburring Check' : 'e.g. Surface Finish (Ra)'
                      }
                      value={paramForm.parameter_name}
                      onChange={(e) => setParamForm({ ...paramForm, parameter_name: e.target.value })}
                      required
                    />
                  </div>

                  {/* RULE 1 FIELDS */}
                  {ruleMode === 'rule1' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Nominal Target *</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={paramForm.nominal_value}
                            onChange={(e) => setParamForm({ ...paramForm, nominal_value: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Upper Tol (+)</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={paramForm.upper_tolerance}
                            onChange={(e) => setParamForm({ ...paramForm, upper_tolerance: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Lower Tol (-)</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={paramForm.lower_tolerance}
                            onChange={(e) => setParamForm({ ...paramForm, lower_tolerance: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 13, color: '#38BDF8', fontWeight: 'bold' }}>
                        Rule 1 Range: [{(nom + lowerT).toFixed(4)} {paramForm.unit}] to [{(nom + upperT).toFixed(4)} {paramForm.unit}]
                      </div>
                    </>
                  )}

                  {/* RULE 2 FIELDS */}
                  {ruleMode === 'rule2' && (
                    <div>
                      <label className="form-label">Master Value / Visual Specification *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 0.5 x 45° Chamfer, No burrs, Surface smooth"
                        value={paramForm.nominal_value || ''}
                        onChange={(e) => setParamForm({ ...paramForm, nominal_value: e.target.value })}
                        required
                      />
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>
                        Inspector sees this value and records <strong>YES (Pass)</strong> or <strong>NO (Fail)</strong>
                      </div>
                    </div>
                  )}


                  {/* RULE 3 FIELDS */}
                  {ruleMode === 'rule3' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Threshold Type</label>
                          <select
                            className="form-select"
                            value={paramForm.measurement_type}
                            onChange={(e) => setParamForm({ ...paramForm, measurement_type: e.target.value })}
                          >
                            <option value="max_limit">≤ Maximum Limit (e.g. ≤ 1.60 Ra)</option>
                            <option value="min_limit">≥ Minimum Limit (e.g. ≥ 5.00 mm)</option>
                            <option value="surface">≤ Surface Finish (Ra)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Threshold Value *</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={paramForm.nominal_value}
                            onChange={(e) => setParamForm({
                              ...paramForm,
                              nominal_value: e.target.value,
                              upper_tolerance: '0.00',
                              lower_tolerance: '0.00',
                            })}
                            required
                          />
                        </div>
                      </div>
                      <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 13, color: '#F59E0B', fontWeight: 'bold' }}>
                        Rule 3 Threshold: {paramForm.measurement_type === 'min_limit' ? `≥ ${nom.toFixed(4)} ${paramForm.unit}` : `≤ ${nom.toFixed(4)} ${paramForm.unit}`}
                      </div>
                    </>
                  )}

                  {/* Unit + Type row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Unit</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {['mm', '°', 'R', 'φ', 'µm', 'Ra', 'mm/rev', 'inch'].map((u) => {
                          const isSelected = paramForm.unit === u;
                          return (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setParamForm({ ...paramForm, unit: u })}
                              style={{
                                padding: '4px 10px', fontSize: 12, fontWeight: 700,
                                borderRadius: 16, border: '1px solid',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                                background: isSelected ? '#0F172A' : '#F8FAFC',
                                color: isSelected ? '#FFFFFF' : '#475569',
                                borderColor: isSelected ? '#0F172A' : '#CBD5E1',
                                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                              }}
                            >{u}</button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom unit if not listed above..."
                        value={paramForm.unit}
                        onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
                        style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Measurement Type Code</label>
                      <input
                        type="text"
                        className="form-input"
                        value={paramForm.measurement_type}
                        readOnly
                        style={{ opacity: 0.75, textTransform: 'uppercase', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* ── CONTROL PLAN COLUMNS ──────────────────── */}
                  <div style={{ borderTop: '1.5px solid #E2E8F0', paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                      Control Plan Details
                    </div>

                    {/* Measurement Technique */}
                    <div style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Evaluation / Measurement Technique</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {['DEPTH VERNIER', 'VERNIER CALIPER', 'VISUALLY', 'PLUGE GAUGE', 'PROFILE PROJECTOR', 'COMPARE WITH MASTER', 'HEIGHT GAUGE', 'MICROMETER'].map((t) => {
                          const isSel = paramForm.measurement_technique === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setParamForm({ ...paramForm, measurement_technique: t })}
                              style={{
                                padding: '4px 9px', fontSize: 11, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                background: isSel ? '#0284C7' : '#F8FAFC',
                                border: isSel ? '1px solid #0284C7' : '1px solid #CBD5E1',
                                color: isSel ? '#FFFFFF' : '#475569',
                                transition: 'all 0.15s ease',
                              }}
                            >{t}</button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Or custom instrument..."
                        value={paramForm.measurement_technique}
                        onChange={(e) => setParamForm({ ...paramForm, measurement_technique: e.target.value })}
                        style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Sample Size + Control Method in 2 cols */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ marginBottom: 4 }}>Sample Size / Frequency</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {['5NOS/SHIFT', '100%', 'LAYOUT INSPECTION', '1st PC/SHIFT'].map((s) => {
                            const isSel = paramForm.sample_size === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setParamForm({ ...paramForm, sample_size: s })}
                                style={{
                                  padding: '3px 8px', fontSize: 10.5, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                  background: isSel ? '#059669' : '#F8FAFC',
                                  border: isSel ? '1px solid #059669' : '1px solid #CBD5E1',
                                  color: isSel ? '#FFFFFF' : '#475569',
                                  transition: 'all 0.15s ease',
                                }}
                              >{s}</button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 5NOS/SHIFT"
                          value={paramForm.sample_size}
                          onChange={(e) => setParamForm({ ...paramForm, sample_size: e.target.value })}
                          style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ marginBottom: 4 }}>Control Method</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {['1st PIECE & INPROCESS INSP.', 'LAYOUT INSPECTION'].map((c) => {
                            const isSel = paramForm.control_method === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setParamForm({ ...paramForm, control_method: c })}
                                style={{
                                  padding: '3px 8px', fontSize: 10.5, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                  background: isSel ? '#7C3AED' : '#F8FAFC',
                                  border: isSel ? '1px solid #7C3AED' : '1px solid #CBD5E1',
                                  color: isSel ? '#FFFFFF' : '#475569',
                                  transition: 'all 0.15s ease',
                                }}
                              >{c}</button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 1st PIECE & INPROCESS INSP."
                          value={paramForm.control_method}
                          onChange={(e) => setParamForm({ ...paramForm, control_method: e.target.value })}
                          style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Critical checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
                    <input
                      type="checkbox"
                      id="isCritical"
                      checked={paramForm.is_critical}
                      onChange={(e) => setParamForm({ ...paramForm, is_critical: e.target.checked })}
                    />
                    <label htmlFor="isCritical" style={{ cursor: 'pointer', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                      ◑ Mark as Special Characteristic / Critical (Triggers Supervisor Alert on Out-of-Spec)
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddParamModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Parameter Rule</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal 5: Supervisor Edit Target Parameters Count */}
        {showEditTargetModal && selectedTemplate && (
          <div className="modal-overlay" onClick={() => setShowEditTargetModal(false)}>
            <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Set Target Parameters Count</h3>
                <button type="button" className="btn-close" onClick={() => setShowEditTargetModal(false)}>×</button>
              </div>
              <form onSubmit={handleSaveTargetCount}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 13, color: '#38BDF8' }}>
                    Operation: <strong>{selectedTemplate?.inspection_type.toUpperCase()}</strong> (Part {selectedPart?.part_number})
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold' }}>
                      Target Parameters Count (e.g. 18, 10, 4) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="form-input"
                      value={editTargetCount}
                      onChange={(e) => setEditTargetCount(parseInt(e.target.value) || 1)}
                      required
                    />
                    <small style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, display: 'block' }}>
                      Set the required number of parameters expected for this operation sheet.
                    </small>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold' }}>
                      Cycle Time (Minutes)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="form-input"
                      value={editCycleTime}
                      onChange={(e) => setEditCycleTime(e.target.value)}
                    />
                    <small style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, display: 'block' }}>
                      Time taken for one operation cycle in minutes.
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowEditTargetModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Target Count</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispatch to Mobile Confirmation Modal */}
        {showPublishModal && (
          <div className="modal-overlay" onClick={() => !isPublishing && setShowPublishModal(false)}>
            <div className="modal-content" style={{ maxWidth: 520, borderRadius: 16, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#fff', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#F8FAFC' }}>Publish & Dispatch to Mobile</h3>
                    <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Broadcast configured parameter sheet to shop floor devices</p>
                  </div>
                </div>
                {!isPublishing && (
                  <button type="button" className="btn-close" style={{ color: '#fff' }} onClick={() => setShowPublishModal(false)}>×</button>
                )}
              </div>

              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Target Scope Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                    Target Machine & Part
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Machine</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{selectedMachine?.machine_code} · {selectedMachine?.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Part & Operation</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{selectedPart?.part_number} · {selectedTemplate?.name || selectedTemplate?.inspection_type}</div>
                    </div>
                  </div>
                </div>

                {/* Parameters Breakdown (Both Product & Process Parameters) */}
                {(() => {
                  const allParams = [
                    ...parameters.map(p => ({ ...p, is_process: false })),
                    ...processParameters.map(p => ({ ...p, is_process: true }))
                  ];
                  const totalCount = allParams.length;

                  const isRule2 = (p) => p.measurement_type === 'visual' || p.measurement_type?.startsWith('rule2') || p.data_type === 'yes_no';
                  const isRule3 = (p) => ['min_limit', 'max_limit', 'surface'].includes(p.measurement_type?.toLowerCase()) || p.measurement_type?.startsWith('rule3');
                  const isRule1 = (p) => !isRule2(p) && !isRule3(p);

                  const rule1Count = allParams.filter(isRule1).length;
                  const rule2Count = allParams.filter(isRule2).length;
                  const rule3Count = allParams.filter(isRule3).length;
                  const criticalCount = allParams.filter((p) => p.is_critical).length;

                  return (
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>
                          Configured Parameters Summary
                        </span>
                        <span style={{ background: '#1D4ED8', color: '#fff', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {totalCount} Total Parameters ({parameters.length} Product + {processParameters.length} Process)
                        </span>
                      </div>

                      {/* Rule Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 4px', border: '1px solid #DBEAFE' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0284C7' }}>{rule1Count}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B' }}>Rule 1 (Range)</div>
                        </div>
                        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 4px', border: '1px solid #DBEAFE' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{rule2Count}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B' }}>Rule 2 (Visual)</div>
                        </div>
                        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 4px', border: '1px solid #DBEAFE' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{rule3Count}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B' }}>Rule 3 (Limit)</div>
                        </div>
                        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 4px', border: '1px solid #DBEAFE' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#DC2626' }}>{criticalCount}</div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B' }}>◑ Critical</div>
                        </div>
                      </div>

                      {/* Category Breakdown Bar */}
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 700 }}>
                        <div style={{ flex: 1, background: '#DBEAFE', color: '#1E40AF', padding: '6px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Product Parameters</span>
                          <span style={{ background: '#1E40AF', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{parameters.length}</span>
                        </div>
                        <div style={{ flex: 1, background: '#F3E8FF', color: '#6B21A8', padding: '6px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Process Parameters</span>
                          <span style={{ background: '#6B21A8', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{processParameters.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Mobile Targets Notification */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 11.5, color: '#166534' }}>
                      <strong>Operator Terminal:</strong> Automatically updates in-process inspection checklist.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 11.5, color: '#166534' }}>
                      <strong>Quality Inspector Terminal:</strong> Ready for 1st Piece Inspection (FPI) verification.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={isPublishing}
                  onClick={() => setShowPublishModal(false)}
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPublishing || parameters.length === 0}
                  onClick={handlePublishTemplate}
                  style={{
                    padding: '10px 22px', fontWeight: 800, borderRadius: 8, fontSize: 13,
                    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#fff', border: 'none', cursor: isPublishing ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {isPublishing ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Broadcasting to Mobile...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Dispatch Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add / Edit Process Parameter */}
        {showProcessParamModal && selectedTemplate && (
          <div className="modal-overlay" onClick={() => setShowProcessParamModal(false)}>
            <div className="modal-content" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingProcessParam ? `Edit Process Parameter Rule` : `Add Process Parameter Rule to [${selectedTemplate?.inspection_type?.toUpperCase()}]`}</h3>
                <button type="button" className="btn-close" onClick={() => setShowProcessParamModal(false)}>×</button>
              </div>
              <form onSubmit={handleSaveProcessParam}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* 3 SPECIFICATION RULES SELECTOR */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 'bold', marginBottom: 6, display: 'block' }}>
                      Select Quality Inspection Rule *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${processRuleMode === 'rule1' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: processRuleMode === 'rule1' ? '2px solid #38BDF8' : '1px solid #334155' }}
                        onClick={() => selectProcessRuleMode('rule1')}
                      >
                        Rule 1: Range (&gt; Limit &lt;)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${processRuleMode === 'rule2' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: processRuleMode === 'rule2' ? '2px solid #10B981' : '1px solid #334155' }}
                        onClick={() => selectProcessRuleMode('rule2')}
                      >
                        Rule 2: Visual (YES/NO)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${processRuleMode === 'rule3' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 4px', fontSize: 11, fontWeight: 'bold', border: processRuleMode === 'rule3' ? '2px solid #F59E0B' : '1px solid #334155' }}
                        onClick={() => selectProcessRuleMode('rule3')}
                      >
                        Rule 3: Limit (&le; or &ge;)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Parameter Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={
                        processRuleMode === 'rule1' ? 'e.g. RPM, Feed Rate, Pressure' :
                        processRuleMode === 'rule2' ? 'e.g. Chamfer & Deburring Check' : 'e.g. Max Temperature (Ra/°C)'
                      }
                      value={processParamForm.parameter_name}
                      onChange={(e) => setProcessParamForm({ ...processParamForm, parameter_name: e.target.value })}
                      required
                    />
                  </div>

                  {/* RULE 1 FIELDS */}
                  {processRuleMode === 'rule1' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Nominal Target *</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={processParamForm.nominal_value}
                            onChange={(e) => setProcessParamForm({ ...processParamForm, nominal_value: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Upper Tol (+)</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={processParamForm.upper_tolerance}
                            onChange={(e) => setProcessParamForm({ ...processParamForm, upper_tolerance: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label">Lower Tol (-)</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={processParamForm.lower_tolerance}
                            onChange={(e) => setProcessParamForm({ ...processParamForm, lower_tolerance: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 13, color: '#38BDF8', fontWeight: 'bold' }}>
                        Rule 1 Range: [{( (parseFloat(processParamForm.nominal_value) || 0) + (parseFloat(processParamForm.lower_tolerance) || 0) ).toFixed(4)} {processParamForm.unit}] to [{ ( (parseFloat(processParamForm.nominal_value) || 0) + Math.abs(parseFloat(processParamForm.upper_tolerance) || 0) ).toFixed(4)} {processParamForm.unit}]
                      </div>
                    </>
                  )}

                  {/* RULE 2 FIELDS */}
                  {processRuleMode === 'rule2' && (
                    <div>
                      <label className="form-label">Master Value / Visual Specification *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 0.5 x 45° Chamfer, No burrs, Surface smooth"
                        value={processParamForm.nominal_value || ''}
                        onChange={(e) => setProcessParamForm({ ...processParamForm, nominal_value: e.target.value })}
                        required
                      />
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748B' }}>
                        Inspector sees this value and records <strong>YES (Pass)</strong> or <strong>NO (Fail)</strong>
                      </div>
                    </div>
                  )}

                  {/* RULE 3 FIELDS */}
                  {processRuleMode === 'rule3' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="form-label">Threshold Type</label>
                          <select
                            className="form-select"
                            value={processParamForm.measurement_type}
                            onChange={(e) => setProcessParamForm({ ...processParamForm, measurement_type: e.target.value })}
                          >
                            <option value="max_limit">≤ Maximum Limit (e.g. ≤ 1200 RPM)</option>
                            <option value="min_limit">≥ Minimum Limit (e.g. ≥ 500 RPM)</option>
                            <option value="surface">≤ Surface Finish (Ra)</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Threshold Value *</label>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            value={processParamForm.nominal_value}
                            onChange={(e) => setProcessParamForm({
                              ...processParamForm,
                              nominal_value: e.target.value,
                              upper_tolerance: '0.00',
                              lower_tolerance: '0.00',
                            })}
                            required
                          />
                        </div>
                      </div>
                      <div style={{ background: '#0F172A', padding: 10, borderRadius: 6, fontSize: 13, color: '#F59E0B', fontWeight: 'bold' }}>
                        Rule 3 Threshold: {processParamForm.measurement_type === 'min_limit' ? `≥ ${(parseFloat(processParamForm.nominal_value) || 0).toFixed(4)} ${processParamForm.unit}` : `≤ ${(parseFloat(processParamForm.nominal_value) || 0).toFixed(4)} ${processParamForm.unit}`}
                      </div>
                    </>
                  )}

                  {/* Unit + Type row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Unit</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {['mm', '°', 'R', 'φ', 'µm', 'Ra', 'mm/rev', 'inch'].map((u) => {
                          const isSelected = processParamForm.unit === u;
                          return (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setProcessParamForm({ ...processParamForm, unit: u })}
                              style={{
                                padding: '4px 10px', fontSize: 12, fontWeight: 700,
                                borderRadius: 16, border: '1px solid',
                                cursor: 'pointer', transition: 'all 0.15s ease',
                                background: isSelected ? '#0F172A' : '#F8FAFC',
                                color: isSelected ? '#FFFFFF' : '#475569',
                                borderColor: isSelected ? '#0F172A' : '#CBD5E1',
                                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                              }}
                            >{u}</button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom unit if not listed above..."
                        value={processParamForm.unit}
                        onChange={(e) => setProcessParamForm({ ...processParamForm, unit: e.target.value })}
                        style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Measurement Type Code</label>
                      <input
                        type="text"
                        className="form-input"
                        value={processParamForm.measurement_type}
                        readOnly
                        style={{ opacity: 0.75, textTransform: 'uppercase', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', borderRadius: 8, padding: '9px 12px', fontSize: 13, width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* ── CONTROL PLAN COLUMNS ──────────────────── */}
                  <div style={{ borderTop: '1.5px solid #E2E8F0', paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                      Control Plan Details
                    </div>

                    {/* Measurement Technique */}
                    <div style={{ marginBottom: 12 }}>
                      <label className="form-label" style={{ marginBottom: 4 }}>Evaluation / Measurement Technique</label>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {['DEPTH VERNIER', 'VERNIER CALIPER', 'VISUALLY', 'PLUGE GAUGE', 'PROFILE PROJECTOR', 'COMPARE WITH MASTER', 'HEIGHT GAUGE', 'MICROMETER'].map((t) => {
                          const isSel = processParamForm.measurement_technique === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setProcessParamForm({ ...processParamForm, measurement_technique: t })}
                              style={{
                                padding: '4px 9px', fontSize: 11, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                background: isSel ? '#0284C7' : '#F8FAFC',
                                border: isSel ? '1px solid #0284C7' : '1px solid #CBD5E1',
                                color: isSel ? '#FFFFFF' : '#475569',
                                transition: 'all 0.15s ease',
                              }}
                            >{t}</button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Or custom instrument..."
                        value={processParamForm.measurement_technique}
                        onChange={(e) => setProcessParamForm({ ...processParamForm, measurement_technique: e.target.value })}
                        style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Sample Size + Control Method in 2 cols */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="form-label" style={{ marginBottom: 4 }}>Sample Size / Frequency</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {['5NOS/SHIFT', '100%', 'LAYOUT INSPECTION', '1st PC/SHIFT'].map((s) => {
                            const isSel = processParamForm.sample_size === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setProcessParamForm({ ...processParamForm, sample_size: s })}
                                style={{
                                  padding: '3px 8px', fontSize: 10.5, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                  background: isSel ? '#059669' : '#F8FAFC',
                                  border: isSel ? '1px solid #059669' : '1px solid #CBD5E1',
                                  color: isSel ? '#FFFFFF' : '#475569',
                                  transition: 'all 0.15s ease',
                                }}
                              >{s}</button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 5NOS/SHIFT"
                          value={processParamForm.sample_size}
                          onChange={(e) => setProcessParamForm({ ...processParamForm, sample_size: e.target.value })}
                          style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ marginBottom: 4 }}>Control Method</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {['1st PIECE & INPROCESS INSP.', 'LAYOUT INSPECTION'].map((c) => {
                            const isSel = processParamForm.control_method === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setProcessParamForm({ ...processParamForm, control_method: c })}
                                style={{
                                  padding: '3px 8px', fontSize: 10.5, fontWeight: isSel ? 700 : 500, borderRadius: 6, cursor: 'pointer',
                                  background: isSel ? '#7C3AED' : '#F8FAFC',
                                  border: isSel ? '1px solid #7C3AED' : '1px solid #CBD5E1',
                                  color: isSel ? '#FFFFFF' : '#475569',
                                  transition: 'all 0.15s ease',
                                }}
                              >{c}</button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 1st PIECE & INPROCESS INSP."
                          value={processParamForm.control_method}
                          onChange={(e) => setProcessParamForm({ ...processParamForm, control_method: e.target.value })}
                          style={{ background: '#fff', border: '1px solid #CBD5E1', color: '#1E293B', borderRadius: 8, padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowProcessParamModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingProcessParam ? 'Save Changes' : 'Add Process Parameter Rule'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
