import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/document_control_service.dart';
import 'document_detail_screen.dart';

class DocumentControlScreen extends StatefulWidget {
  const DocumentControlScreen({super.key});

  @override
  State<DocumentControlScreen> createState() => _DocumentControlScreenState();
}

class _DocumentControlScreenState extends State<DocumentControlScreen> {
  final _service = DocumentControlService();
  final _searchCtrl = TextEditingController();

  List<Document> _docs = [];
  List<DocumentCategory> _categories = [];
  String _selectedCategory = '';
  bool _loading = true;
  String? _error;

  // Status colors
  static const _statusConfig = {
    'draft':        {'label': 'Draft',        'color': Color(0xFF64748B), 'bg': Color(0xFFF1F5F9)},
    'under_review': {'label': 'Under Review', 'color': Color(0xFFD97706), 'bg': Color(0xFFFEF3C7)},
    'approved':     {'label': 'Approved',     'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5)},
    'rejected':     {'label': 'Rejected',     'color': Color(0xFFDC2626), 'bg': Color(0xFFFEE2E2)},
    'obsolete':     {'label': 'Obsolete',     'color': Color(0xFF94A3B8), 'bg': Color(0xFFF1F5F9)},
  };

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        _service.getDocuments(category: _selectedCategory.isEmpty ? null : _selectedCategory),
        _service.getCategories(),
      ]);
      setState(() {
        _docs = results[0] as List<Document>;
        _categories = results[1] as List<DocumentCategory>;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  List<Document> get _filteredDocs {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _docs;
    return _docs.where((d) =>
        d.title.toLowerCase().contains(q) ||
        d.documentNumber.toLowerCase().contains(q) ||
        (d.categoryName?.toLowerCase().contains(q) ?? false)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Document Control', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
            color: const Color(0xFF6366F1),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search + Filter Bar
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                // Search field
                TextField(
                  controller: _searchCtrl,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Search documents…',
                    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                    prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF94A3B8), size: 20),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Category chips
                if (_categories.isNotEmpty)
                  SizedBox(
                    height: 32,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _buildCategoryChip('All', ''),
                        ..._categories.map((c) => _buildCategoryChip(c.name, c.id.toString())),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // Content
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
                : _error != null
                    ? _buildError()
                    : _filteredDocs.isEmpty
                        ? _buildEmpty()
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredDocs.length,
                            itemBuilder: (ctx, i) => _buildDocCard(_filteredDocs[i]),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip(String label, String value) {
    final selected = _selectedCategory == value;
    return GestureDetector(
      onTap: () { setState(() => _selectedCategory = value); _loadData(); },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF6366F1) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? const Color(0xFF6366F1) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12, fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildDocCard(Document doc) {
    final statusCfg = _statusConfig[doc.status] ?? _statusConfig['draft']!;
    final statusColor = statusCfg['color'] as Color;
    final statusBg = statusCfg['bg'] as Color;
    final statusLabel = statusCfg['label'] as String;

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(doc.title, style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF0F172A))),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                        color: statusBg, borderRadius: BorderRadius.circular(20)),
                    child: Text(statusLabel,
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: statusColor)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Text(doc.documentNumber,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6366F1), fontWeight: FontWeight.w700)),
                  const SizedBox(width: 8),
                  Text('• ${doc.revision}',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  if (doc.categoryName != null) ...[
                    const SizedBox(width: 8),
                    Text('• ${doc.categoryName}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ],
                ],
              ),
              if (doc.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(doc.description,
                    maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4)),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 4),
                  Text(doc.uploadedByName ?? '—',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                  const Spacer(),
                  if (doc.cloudinaryUrl != null)
                    const Icon(Icons.attachment_rounded, size: 14, color: Color(0xFF6366F1)),
                  const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFCBD5E1)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty() => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.folder_open_rounded, size: 52, color: Colors.grey.shade300),
          const SizedBox(height: 14),
          Text('No documents found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade500)),
          const SizedBox(height: 6),
          Text('Try a different search or category.', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
        ]),
      );

  Widget _buildError() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.error_outline_rounded, size: 44, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text('Failed to load documents', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.red.shade700)),
            const SizedBox(height: 8),
            Text(_error ?? '', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            )
          ]),
        ),
      );
}
