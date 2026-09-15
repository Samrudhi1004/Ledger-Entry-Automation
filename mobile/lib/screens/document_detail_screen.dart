import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import '../services/document_control_service.dart';
import '../widgets/dcr_submission_sheet.dart';

class DocumentDetailScreen extends StatefulWidget {
  final String documentId;
  const DocumentDetailScreen({super.key, required this.documentId});

  @override
  State<DocumentDetailScreen> createState() => _DocumentDetailScreenState();
}

class _DocumentDetailScreenState extends State<DocumentDetailScreen> {
  final _service = DocumentControlService();
  Document? _doc;
  List<DocumentActivity> _activities = [];
  bool _loading = true;
  bool _historyLoading = false;
  String? _error;

  static const _levelColors = {
    'L1': {'color': Color(0xFF6366F1), 'bg': Color(0xFFEEF2FF), 'label': 'L1 Quality Manual'},
    'L2': {'color': Color(0xFF0284C7), 'bg': Color(0xFFE0F2FE), 'label': 'L2 Procedures'},
    'L3': {'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5), 'label': 'L3 Work Instructions'},
    'L4': {'color': Color(0xFFD97706), 'bg': Color(0xFFFEF3C7), 'label': 'L4 Forms & Formats'},
  };

  static const _statusConfig = {
    'draft':        {'label': 'Draft',        'color': Color(0xFF64748B), 'bg': Color(0xFFF1F5F9)},
    'under_review': {'label': 'Under Review', 'color': Color(0xFFD97706), 'bg': Color(0xFFFEF3C7)},
    'approved':     {'label': 'Approved',     'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5)},
    'rejected':     {'label': 'Rejected',     'color': Color(0xFFDC2626), 'bg': Color(0xFFFEE2E2)},
    'obsolete':     {'label': 'Obsolete',     'color': Color(0xFF94A3B8), 'bg': Color(0xFFF1F5F9)},
  };

  static const _actionEmoji = {
    'uploaded': '📤',
    'submitted_review': '📋',
    'approved': '✅',
    'rejected': '❌',
    'revised': '🔄',
    'downloaded': '⬇️',
    'obsoleted': '🗄️',
    'comment': '💬',
  };

  @override
  void initState() {
    super.initState();
    _loadDoc();
  }

  Future<void> _loadDoc() async {
    setState(() { _loading = true; _error = null; });
    try {
      final doc = await _service.getDocumentById(widget.documentId);
      setState(() { _doc = doc; _loading = false; });
      _loadHistory();
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _loadHistory() async {
    setState(() => _historyLoading = true);
    try {
      final acts = await _service.getDocumentHistory(widget.documentId);
      setState(() => _activities = acts);
    } catch (_) {}
    setState(() => _historyLoading = false);
  }

  Future<void> _openFile() async {
    final url = _doc?.cloudinaryUrl;
    if (url == null) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open the document file.')),
        );
      }
    }
  }

  String _formatDate(String? d) {
    if (d == null || d.isEmpty) return '—';
    try {
      final dt = DateTime.parse(d);
      return '${dt.day.toString().padLeft(2, '0')} ${_monthName(dt.month)} ${dt.year}';
    } catch (_) { return d; }
  }

  String _monthName(int m) =>
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final canSubmitDCR = !auth.isOperator && !auth.isInspector;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          _doc?.documentNumber ?? 'Document Detail',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
        actions: [
          if (_doc?.cloudinaryUrl != null)
            IconButton(
              icon: const Icon(Icons.download_rounded, color: Color(0xFF6366F1)),
              tooltip: 'Open / Download File',
              onPressed: _openFile,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
          : _error != null
              ? _buildError()
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildInfoCard(),
                      const SizedBox(height: 16),
                      if (canSubmitDCR) _buildDCRActionBanner(),
                      if (canSubmitDCR) const SizedBox(height: 16),
                      if (_doc?.cloudinaryUrl != null) _buildFileCard(),
                      if (_doc?.cloudinaryUrl != null) const SizedBox(height: 16),
                      _buildActivityLog(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoCard() {
    final doc = _doc!;
    final statusCfg = _statusConfig[doc.status] ?? _statusConfig['draft']!;
    final statusColor = statusCfg['color'] as Color;
    final statusBg = statusCfg['bg'] as Color;
    final statusLabel = statusCfg['label'] as String;

    final levelCfg = _levelColors[doc.docLevel] ?? _levelColors['L2']!;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Level badge + Status badge row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: levelCfg['bg'] as Color,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  doc.docLevelLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: levelCfg['color'] as Color,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
                child: Text(statusLabel, style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Title
          Text(
            doc.title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 6),

          // Doc number + revision
          Row(
            children: [
              Text(doc.documentNumber,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF6366F1))),
              const SizedBox(width: 8),
              Container(width: 4, height: 4, decoration: const BoxDecoration(color: Color(0xFFCBD5E1), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(doc.revision, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            ],
          ),
          if (doc.description.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(doc.description, style: const TextStyle(fontSize: 14, color: Color(0xFF475569), height: 1.5)),
          ],
          const SizedBox(height: 16),
          const Divider(color: Color(0xFFF1F5F9), height: 1),
          const SizedBox(height: 14),
          // Meta grid
          _buildMetaGrid(doc),
        ],
      ),
    );
  }

  Widget _buildDCRActionBanner() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDDD6FE)),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF7C3AED).withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.edit_document, color: Color(0xFF7C3AED), size: 22),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Need modifications?',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                Text(
                  'Raise Form DKI/MR/F/05 Change Request',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => DCRSubmissionSheet.show(
              context,
              document: _doc!,
              onSuccess: () => Navigator.pop(context),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C3AED),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Request DCR', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildMetaGrid(Document doc) {
    final items = [
      {'label': 'Doc Level', 'value': doc.docLevel, 'icon': Icons.layers_outlined},
      {'label': 'Uploaded By', 'value': doc.uploadedByName ?? '—', 'icon': Icons.person_outline_rounded},
      {'label': 'Approved By', 'value': doc.approvedByName ?? 'Pending', 'icon': Icons.verified_outlined},
      {'label': 'Effective Date', 'value': _formatDate(doc.effectiveDate), 'icon': Icons.calendar_today_outlined},
      {'label': 'Uploaded On', 'value': _formatDate(doc.createdAt), 'icon': Icons.access_time_rounded},
      {'label': 'File Size', 'value': doc.fileSizeDisplay, 'icon': Icons.storage_outlined},
    ];

    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: items.map((item) => SizedBox(
        width: (MediaQuery.of(context).size.width - 72) / 2,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(item['icon'] as IconData, size: 15, color: const Color(0xFF94A3B8)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item['label'] as String, style: const TextStyle(
                    fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(item['value'] as String, style: const TextStyle(
                    fontSize: 13, color: Color(0xFF0F172A), fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis, maxLines: 2),
              ]),
            ),
          ],
        ),
      )).toList(),
    );
  }

  Widget _buildFileCard() {
    return GestureDetector(
      onTap: _openFile,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 6))],
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.open_in_new_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Open / View Document',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                const SizedBox(height: 2),
                Text(_doc?.fileName ?? 'Document file',
                    style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 12),
                    overflow: TextOverflow.ellipsis),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityLog() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text('Activity Log', style: TextStyle(
              fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
        ),
        if (_historyLoading)
          const Center(child: Padding(
            padding: EdgeInsets.all(20),
            child: CircularProgressIndicator(color: Color(0xFF6366F1), strokeWidth: 2),
          ))
        else if (_activities.isEmpty)
          Container(
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0))),
            padding: const EdgeInsets.all(24),
            child: const Center(child: Text('No activity recorded yet.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14))),
          )
        else
          ...List.generate(_activities.length, (i) {
            final a = _activities[i];
            final emoji = _actionEmoji[a.action] ?? '•';
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Text(a.action.replaceAll('_', ' ').toUpperCase(),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                        const Spacer(),
                        Text(_formatDate(a.timestamp),
                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                      ]),
                      const SizedBox(height: 3),
                      Text('By ${a.performedByName}',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      if (a.comment.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text('"${a.comment}"',
                            style: const TextStyle(fontSize: 13, color: Color(0xFF475569), fontStyle: FontStyle.italic)),
                      ],
                    ]),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildError() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.error_outline_rounded, size: 44, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text('Failed to load document', style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: Colors.red.shade700)),
            const SizedBox(height: 8),
            Text(_error ?? '', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadDoc,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            ),
          ]),
        ),
      );
}
