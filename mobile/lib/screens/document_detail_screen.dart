import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/document_control_service.dart';

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
      setState(() { _error = e.toString(); _loading = false; });
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
                      if (_doc?.cloudinaryUrl != null) _buildFileCard(),
                      const SizedBox(height: 16),
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
          // Title + Status
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(doc.title, style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
                child: Text(statusLabel, style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Doc number + revision
          Row(
            children: [
              Text(doc.documentNumber,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF6366F1))),
              const SizedBox(width: 8),
              Container(width: 4, height: 4, decoration: const BoxDecoration(color: Color(0xFFCBD5E1), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(doc.revision, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
              if (doc.categoryName != null) ...[
                const SizedBox(width: 8),
                Container(width: 4, height: 4, decoration: const BoxDecoration(color: Color(0xFFCBD5E1), shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(doc.categoryName!, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
              ],
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

  Widget _buildMetaGrid(Document doc) {
    final items = [
      {'label': 'Uploaded By', 'value': doc.uploadedByName ?? '—', 'icon': Icons.person_outline_rounded},
      {'label': 'Approved By', 'value': doc.approvedByName ?? 'Pending', 'icon': Icons.verified_outlined},
      {'label': 'Effective Date', 'value': _formatDate(doc.effectiveDate), 'icon': Icons.calendar_today_outlined},
      {'label': 'Uploaded On', 'value': _formatDate(doc.createdAt), 'icon': Icons.access_time_rounded},
      {'label': 'File Name', 'value': doc.fileName ?? '—', 'icon': Icons.insert_drive_file_outlined},
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
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.open_in_new_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Open / Download File',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 3),
                Text(_doc?.fileName ?? 'Document file',
                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
                    overflow: TextOverflow.ellipsis),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 22),
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
                borderLeft: const Border(left: BorderSide(color: Color(0xFF6366F1), width: 3)),
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
