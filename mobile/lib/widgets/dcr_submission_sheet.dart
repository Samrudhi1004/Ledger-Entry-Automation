import 'package:flutter/material.dart';
import '../services/document_control_service.dart';

class DCRSubmissionSheet extends StatefulWidget {
  final Document document;
  final VoidCallback? onSuccess;

  const DCRSubmissionSheet({
    super.key,
    required this.document,
    this.onSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    required Document document,
    VoidCallback? onSuccess,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DCRSubmissionSheet(
        document: document,
        onSuccess: onSuccess,
      ),
    );
  }

  @override
  State<DCRSubmissionSheet> createState() => _DCRSubmissionSheetState();
}

class _DCRSubmissionSheetState extends State<DCRSubmissionSheet> {
  final _service = DocumentControlService();
  final _reasonCtrl = TextEditingController();
  final _natureCtrl = TextEditingController();
  final _docNoCtrl = TextEditingController(text: 'DKI/MR/F/05');
  final _issueNoDateCtrl = TextEditingController(text: '01/01.04.2018');
  final _revNoDateCtrl = TextEditingController(text: '01/01.04.2018');
  late final TextEditingController _existingRevCtrl;
  late final TextEditingController _proposedRevCtrl;

  String _changeType = 'modification';
  Map<String, List<DCRUser>> _assignable = {};
  int? _selectedReviewerId;
  int? _selectedCalibratorId;
  int? _selectedApproverId;

  bool _loadingUsers = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _existingRevCtrl = TextEditingController(text: widget.document.revision);
    _proposedRevCtrl = TextEditingController(text: _suggestNextRev(widget.document.revision));
    _loadAssignableUsers();
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    _natureCtrl.dispose();
    _docNoCtrl.dispose();
    _issueNoDateCtrl.dispose();
    _revNoDateCtrl.dispose();
    _existingRevCtrl.dispose();
    _proposedRevCtrl.dispose();
    super.dispose();
  }

  String _suggestNextRev(String current) {
    if (current.toUpperCase().startsWith('REV ')) {
      final letter = current.substring(4).trim().toUpperCase();
      if (letter.length == 1) {
        final code = letter.codeUnitAt(0);
        if (code >= 65 && code < 90) {
          return 'Rev ${String.fromCharCode(code + 1)}';
        }
      }
    }
    return '$current.1';
  }

  Future<void> _loadAssignableUsers() async {
    try {
      final data = await _service.getAssignableUsers();
      if (mounted) {
        setState(() {
          _assignable = data;
          _loadingUsers = false;
          final reviewers = data['reviewers'] ?? [];
          final approvers = data['approvers'] ?? [];
          if (reviewers.isNotEmpty) _selectedReviewerId = reviewers.first.id;
          if (approvers.isNotEmpty) _selectedApproverId = approvers.first.id;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load assignable users: $e';
          _loadingUsers = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a Reason for Change')),
      );
      return;
    }
    if (_selectedReviewerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a Reviewer')),
      );
      return;
    }
    if (_selectedApproverId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select an Approver (MR / Admin)')),
      );
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _service.submitDCR(
        documentId: widget.document.id,
        changeType: _changeType,
        reasonForChange: reason,
        natureOfChange: _natureCtrl.text.trim(),
        formDocNo: _docNoCtrl.text.trim(),
        issueNoDate: _issueNoDateCtrl.text.trim(),
        revNoDate: _revNoDateCtrl.text.trim(),
        existingRevision: _existingRevCtrl.text.trim(),
        proposedRevision: _proposedRevCtrl.text.trim(),
        reviewerId: _selectedReviewerId!,
        calibratorId: _selectedCalibratorId,
        approverId: _selectedApproverId!,
      );

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('DCR submitted successfully! Reviewer notified.'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        widget.onSuccess?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F3FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.assignment_add, color: Color(0xFF7C3AED), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Request Document Change',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      'Standard Form DKI/MR/F/05 • ISO 9001 / IATF 16949',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Scrollable form body
          Flexible(
            child: _loadingUsers
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(color: Color(0xFF7C3AED)),
                    ),
                  )
                : ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    children: [
                      // Target document summary card
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF6366F1).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                widget.document.docLevel,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11,
                                  color: Color(0xFF6366F1),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    widget.document.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: Color(0xFF0F172A),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${widget.document.documentNumber} • ${widget.document.revision}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Form Header References (Editable Form DKI/MR/F/05 metadata)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'FORM HEADER METADATA (DKI/MR/F/05)',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF475569),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _docNoCtrl,
                                    decoration: const InputDecoration(
                                      labelText: 'Doc No',
                                      labelStyle: TextStyle(fontSize: 11),
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _issueNoDateCtrl,
                                    decoration: const InputDecoration(
                                      labelText: 'Issue No/Date',
                                      labelStyle: TextStyle(fontSize: 11),
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _revNoDateCtrl,
                                    decoration: const InputDecoration(
                                      labelText: 'Rev No/Date',
                                      labelStyle: TextStyle(fontSize: 11),
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Change Type
                      const Text(
                        'Change Type *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _buildTypeChip('Modification', 'modification'),
                          const SizedBox(width: 8),
                          _buildTypeChip('Addition', 'addition'),
                          const SizedBox(width: 8),
                          _buildTypeChip('Deletion', 'deletion'),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Existing & Proposed Revision
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Existing Rev',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                                ),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _existingRevCtrl,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Proposed Rev *',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                                ),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _proposedRevCtrl,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: Colors.white,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Reason for Change
                      const Text(
                        'Reason for Change *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _reasonCtrl,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'e.g. Customer requirement / Process audit finding / Tool upgrade',
                          hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Nature of Change
                      const Text(
                        'Nature of Change / Specific Details',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _natureCtrl,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Detailed description of changes in sections, parameters, drawings...',
                          hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // CFT Reviewer Dropdown
                      const Text(
                        'CFT Reviewer * (Engineering / Quality Supervisor)',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<int>(
                        value: _selectedReviewerId,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                        items: (_assignable['reviewers'] ?? []).map((u) {
                          return DropdownMenuItem<int>(
                            value: u.id,
                            child: Text(
                              '${u.fullName} (${u.role.replaceAll('_', ' ')})',
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (v) => setState(() => _selectedReviewerId = v),
                      ),
                      const SizedBox(height: 14),

                      // Optional Calibrator Dropdown
                      const Text(
                        'Calibrator (Optional for gauge / tool changes)',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<int>(
                        value: _selectedCalibratorId,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                        items: [
                          const DropdownMenuItem<int>(
                            value: null,
                            child: Text('None (Not calibration related)', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
                          ),
                          ...(_assignable['calibrators'] ?? []).map((u) {
                            return DropdownMenuItem<int>(
                              value: u.id,
                              child: Text(
                                '${u.fullName} (${u.role.replaceAll('_', ' ')})',
                                style: const TextStyle(fontSize: 13),
                              ),
                            );
                          }),
                        ],
                        onChanged: (v) => setState(() => _selectedCalibratorId = v),
                      ),
                      const SizedBox(height: 14),

                      // Approver Dropdown (MR / Admin)
                      const Text(
                        'Management Representative (MR / Admin Approver) *',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<int>(
                        value: _selectedApproverId,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                        items: (_assignable['approvers'] ?? []).map((u) {
                          return DropdownMenuItem<int>(
                            value: u.id,
                            child: Text(
                              '${u.fullName} (Admin / MR)',
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (v) => setState(() => _selectedApproverId = v),
                      ),

                      if (_error != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _error!,
                            style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),

          const SizedBox(height: 12),
          // Submit button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C3AED),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      'Submit DCR (DKI/MR/F/05)',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeChip(String label, String value) {
    final selected = _changeType == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _changeType = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF7C3AED) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }
}
