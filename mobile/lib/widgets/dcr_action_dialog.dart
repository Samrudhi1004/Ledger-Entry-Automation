import 'package:flutter/material.dart';
import '../services/document_control_service.dart';

class DCRActionDialog extends StatefulWidget {
  final DocumentChangeRequest dcr;
  final String actionType; // 'review' or 'approval'
  final VoidCallback? onSuccess;

  const DCRActionDialog({
    super.key,
    required this.dcr,
    required this.actionType,
    this.onSuccess,
  });

  static Future<void> show(
    BuildContext context, {
    required DocumentChangeRequest dcr,
    required String actionType,
    VoidCallback? onSuccess,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => DCRActionDialog(
        dcr: dcr,
        actionType: actionType,
        onSuccess: onSuccess,
      ),
    );
  }

  @override
  State<DCRActionDialog> createState() => _DCRActionDialogState();
}

class _DCRActionDialogState extends State<DCRActionDialog> {
  final _service = DocumentControlService();
  final _commentsCtrl = TextEditingController();
  final _rejectReasonCtrl = TextEditingController();
  bool _isRejecting = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _commentsCtrl.dispose();
    _rejectReasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleApprove() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      if (widget.actionType == 'review') {
        await _service.submitReview(
          widget.dcr.id,
          action: 'approve',
          comments: _commentsCtrl.text.trim(),
        );
      } else {
        await _service.submitApproval(
          widget.dcr.id,
          action: 'approve',
          comments: _commentsCtrl.text.trim(),
        );
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.actionType == 'review'
                ? 'Review approved! Forwarded to MR Approver.'
                : 'DCR Approved! Document status updated.'),
            backgroundColor: const Color(0xFF059669),
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

  Future<void> _handleReject() async {
    final reason = _rejectReasonCtrl.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'Please provide a reason for rejection.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      if (widget.actionType == 'review') {
        await _service.submitReview(
          widget.dcr.id,
          action: 'reject',
          rejectedReason: reason,
        );
      } else {
        await _service.submitApproval(
          widget.dcr.id,
          action: 'reject',
          rejectedReason: reason,
        );
      }

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('DCR Rejected. Requestor notified via in-app & email.'),
            backgroundColor: Color(0xFFDC2626),
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
    final isReview = widget.actionType == 'review';
    final title = isReview ? 'CFT Review (Form DKI/MR/F/05)' : 'Final Approval (MR / Admin)';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      actionsPadding: const EdgeInsets.all(16),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF7C3AED).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  widget.dcr.dcrNumber,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF7C3AED)),
                ),
              ),
              const Spacer(),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.close_rounded, size: 20, color: Color(0xFF94A3B8)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          Text(widget.dcr.documentTitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            const SizedBox(height: 14),

            // Summary of changes
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Change: ${widget.dcr.changeTypeDisplay} • ${widget.dcr.existingRevision} ➔ ${widget.dcr.proposedRevision}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155))),
                  const SizedBox(height: 4),
                  Text('Reason: ${widget.dcr.reasonForChange}',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                  if (widget.dcr.natureOfChange.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text('Nature: ${widget.dcr.natureOfChange}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (!_isRejecting) ...[
              const Text(
                'Approval Comments (Optional)',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _commentsCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'Add remarks for the records / requestor...',
                  hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.all(10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                ),
              ),
            ] else ...[
              const Text(
                'Reason for Rejection * (Mandatory)',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFFDC2626)),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _rejectReasonCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Specify clear reason why this DCR cannot be accepted...',
                  hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  filled: true,
                  fillColor: const Color(0xFFFEF2F2),
                  contentPadding: const EdgeInsets.all(10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFF87171))),
                ),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
            ],
          ],
        ),
      ),
      actions: [
        if (!_isRejecting) ...[
          TextButton(
            onPressed: () => setState(() {
              _isRejecting = true;
              _error = null;
            }),
            child: const Text('Reject DCR', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: _submitting ? null : _handleApprove,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: _submitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text(isReview ? 'Approve & Forward' : 'Approve & Finalize', style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ] else ...[
          TextButton(
            onPressed: () => setState(() {
              _isRejecting = false;
              _error = null;
            }),
            child: const Text('Cancel Rejection'),
          ),
          ElevatedButton(
            onPressed: _submitting ? null : _handleReject,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: _submitting
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Confirm Rejection', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ],
    );
  }
}
