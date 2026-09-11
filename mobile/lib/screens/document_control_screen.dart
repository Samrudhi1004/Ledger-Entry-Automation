import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import '../services/document_control_service.dart';
import '../widgets/dcr_action_dialog.dart';
import '../widgets/dcr_notifications_sheet.dart';
import '../widgets/dcr_submission_sheet.dart';
import 'document_detail_screen.dart';

class DocumentControlScreen extends StatefulWidget {
  const DocumentControlScreen({super.key});

  @override
  State<DocumentControlScreen> createState() => _DocumentControlScreenState();
}

class _DocumentControlScreenState extends State<DocumentControlScreen>
    with SingleTickerProviderStateMixin {
  final _service = DocumentControlService();
  final _searchCtrl = TextEditingController();

  late TabController _tabController;

  // Documents state
  List<Document> _docs = [];
  List<DocumentCategory> _categories = [];
  String _selectedLevel = ''; // '', 'L1', 'L2', 'L3', 'L4'
  String _selectedCategory = '';
  bool _loadingDocs = true;
  String? _docsError;

  // DCR state
  List<DocumentChangeRequest> _dcrs = [];
  String _dcrTab = 'action_required'; // 'action_required', 'my_requests', 'all'
  bool _loadingDcrs = true;
  String? _dcrsError;

  // Notifications
  int _unreadNotifications = 0;

  // Color mappings
  static const _levelColors = {
    'L1': {'color': Color(0xFF6366F1), 'bg': Color(0xFFEEF2FF), 'label': 'L1 Quality Manual'},
    'L2': {'color': Color(0xFF0284C7), 'bg': Color(0xFFE0F2FE), 'label': 'L2 Procedures'},
    'L3': {'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5), 'label': 'L3 Work Instructions'},
    'L4': {'color': Color(0xFFD97706), 'bg': Color(0xFFFEF3C7), 'label': 'L4 Forms & Formats'},
  };

  static const _statusConfig = {
    'draft': {'label': 'Draft', 'color': Color(0xFF64748B), 'bg': Color(0xFFF1F5F9)},
    'under_review': {'label': 'Under Review', 'color': Color(0xFFD97706), 'bg': Color(0xFFFEF3C7)},
    'approved': {'label': 'Approved', 'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5)},
    'rejected': {'label': 'Rejected', 'color': Color(0xFFDC2626), 'bg': Color(0xFFFEE2E2)},
    'obsolete': {'label': 'Obsolete', 'color': Color(0xFF94A3B8), 'bg': Color(0xFFF1F5F9)},
  };

  static const _dcrStatusConfig = {
    'draft': {'label': 'Draft', 'color': Color(0xFF64748B), 'bg': Color(0xFFF1F5F9)},
    'submitted': {'label': 'Submitted', 'color': Color(0xFF2563EB), 'bg': Color(0xFFEFF6FF)},
    'reviewed': {'label': 'Reviewed', 'color': Color(0xFF7C3AED), 'bg': Color(0xFFF5F3FF)},
    'approved': {'label': 'Approved', 'color': Color(0xFF059669), 'bg': Color(0xFFD1FAE5)},
    'rejected': {'label': 'Rejected', 'color': Color(0xFFDC2626), 'bg': Color(0xFFFEE2E2)},
    'implemented': {'label': 'Implemented', 'color': Color(0xFF0D9488), 'bg': Color(0xFFCCFBF1)},
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadDocs();
    _loadDcrs();
    _loadUnreadCount();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUnreadCount() async {
    final count = await _service.getUnreadNotificationCount();
    if (mounted) setState(() => _unreadNotifications = count);
  }

  Future<void> _loadDocs() async {
    setState(() {
      _loadingDocs = true;
      _docsError = null;
    });
    try {
      final results = await Future.wait([
        _service.getDocuments(
          category: _selectedCategory.isEmpty ? null : _selectedCategory,
          level: _selectedLevel.isEmpty ? null : _selectedLevel,
        ),
        _service.getCategories(),
      ]);
      setState(() {
        _docs = results[0] as List<Document>;
        _categories = results[1] as List<DocumentCategory>;
        _loadingDocs = false;
      });
    } catch (e) {
      setState(() {
        _docsError = e.toString().replaceFirst('Exception: ', '');
        _loadingDocs = false;
      });
    }
  }

  Future<void> _loadDcrs() async {
    setState(() {
      _loadingDcrs = true;
      _dcrsError = null;
    });
    try {
      final list = await _service.getDCRs(tab: _dcrTab);
      setState(() {
        _dcrs = list;
        _loadingDcrs = false;
      });
    } catch (e) {
      setState(() {
        _dcrsError = e.toString().replaceFirst('Exception: ', '');
        _loadingDcrs = false;
      });
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

  Future<void> _openFile(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open document URL')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final canSubmitDCR = !auth.isOperator && !auth.isInspector;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Document Control',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        actions: [
          // Notification Bell
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined, color: Color(0xFF64748B)),
                onPressed: () => DCRNotificationsSheet.show(
                  context,
                  onNotificationsChanged: () {
                    _loadUnreadCount();
                    _loadDcrs();
                  },
                ),
              ),
              if (_unreadNotifications > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Color(0xFFDC2626),
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$_unreadNotifications',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF6366F1)),
            onPressed: () {
              _loadDocs();
              _loadDcrs();
              _loadUnreadCount();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF6366F1),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF6366F1),
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          tabs: const [
            Tab(text: 'Documents (L1–L4)'),
            Tab(text: 'Change Requests (DCR)'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Documents Browser
          _buildDocumentsTab(canSubmitDCR),
          // Tab 2: DCR Management
          _buildDCRTab(auth),
        ],
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: DOCUMENTS
  // ───────────────────────────────────────────────────────────────────────────

  Widget _buildDocumentsTab(bool canSubmitDCR) {
    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            children: [
              // Search Input
              TextField(
                controller: _searchCtrl,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Search title, doc number, category...',
                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
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
                ),
              ),
              const SizedBox(height: 10),

              // Level Selector (L1 - L4)
              SizedBox(
                height: 32,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildLevelChip('All Levels', ''),
                    _buildLevelChip('L1 Quality Manual', 'L1'),
                    _buildLevelChip('L2 Procedures', 'L2'),
                    _buildLevelChip('L3 Work Instructions', 'L3'),
                    _buildLevelChip('L4 Forms / Formats', 'L4'),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Document List
        Expanded(
          child: _loadingDocs
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF6366F1)))
              : _docsError != null
                  ? _buildError(_docsError!, _loadDocs)
                  : _filteredDocs.isEmpty
                      ? _buildEmpty('No documents found in this level or search.')
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filteredDocs.length,
                          itemBuilder: (ctx, i) => _buildDocCard(_filteredDocs[i], canSubmitDCR),
                        ),
        ),
      ],
    );
  }

  Widget _buildLevelChip(String label, String level) {
    final selected = _selectedLevel == level;
    final cfg = _levelColors[level];
    final color = cfg?['color'] as Color? ?? const Color(0xFF6366F1);

    return GestureDetector(
      onTap: () {
        setState(() => _selectedLevel = level);
        _loadDocs();
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? color : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildDocCard(Document doc, bool canSubmitDCR) {
    final statusCfg = _statusConfig[doc.status] ?? _statusConfig['draft']!;
    final levelCfg = _levelColors[doc.docLevel] ?? _levelColors['L2']!;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: Level Badge + Status Badge
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: levelCfg['bg'] as Color,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      doc.docLevel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: levelCfg['color'] as Color,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    doc.documentNumber,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6366F1),
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusCfg['bg'] as Color,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      statusCfg['label'] as String,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: statusCfg['color'] as Color,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Title
              Text(
                doc.title,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),

              // Revision & Category
              Row(
                children: [
                  Text(
                    doc.revision,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                  if (doc.categoryName != null) ...[
                    const SizedBox(width: 6),
                    Text('• ${doc.categoryName}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ],
                ],
              ),
              const SizedBox(height: 12),

              // Bottom Actions Row
              Row(
                children: [
                  if (doc.cloudinaryUrl != null)
                    OutlinedButton.icon(
                      onPressed: () => _openFile(doc.cloudinaryUrl),
                      icon: const Icon(Icons.remove_red_eye_outlined, size: 14),
                      label: const Text('View File', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF6366F1),
                        side: const BorderSide(color: Color(0xFFE0E7FF)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  const Spacer(),
                  if (canSubmitDCR)
                    TextButton.icon(
                      onPressed: () => DCRSubmissionSheet.show(
                        context,
                        document: doc,
                        onSuccess: () {
                          _loadDcrs();
                          _tabController.animateTo(1);
                        },
                      ),
                      icon: const Icon(Icons.edit_document, size: 14, color: Color(0xFF7C3AED)),
                      label: const Text('Request DCR', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF7C3AED))),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFCBD5E1)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: CHANGE REQUESTS (DCR)
  // ───────────────────────────────────────────────────────────────────────────

  Widget _buildDCRTab(AuthProvider auth) {
    return Column(
      children: [
        // Sub-filter tabs
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildDCRSubTab('Action Required', 'action_required'),
              const SizedBox(width: 8),
              _buildDCRSubTab('My Requests', 'my_requests'),
              const SizedBox(width: 8),
              _buildDCRSubTab('All DCRs', 'all'),
            ],
          ),
        ),

        // DCR List
        Expanded(
          child: _loadingDcrs
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF7C3AED)))
              : _dcrsError != null
                  ? _buildError(_dcrsError!, _loadDcrs)
                  : _dcrs.isEmpty
                      ? _buildEmpty('No change requests in this queue.')
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _dcrs.length,
                          itemBuilder: (ctx, i) => _buildDCRCard(_dcrs[i], auth),
                        ),
        ),
      ],
    );
  }

  Widget _buildDCRSubTab(String label, String value) {
    final selected = _dcrTab == value;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _dcrTab = value);
          _loadDcrs();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF7C3AED) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
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

  Widget _buildDCRCard(DocumentChangeRequest dcr, AuthProvider auth) {
    final statusCfg = _dcrStatusConfig[dcr.status] ?? _dcrStatusConfig['submitted']!;
    final levelCfg = _levelColors[dcr.docLevel] ?? _levelColors['L2']!;

    // Check if current user can review or approve
    final isSubmitted = dcr.status == 'submitted';
    final isReviewed = dcr.status == 'reviewed';
    final isReviewer = auth.userRole == 'supervisor' || auth.userRole == 'calibrator' || auth.userRole == 'admin';
    final isApprover = auth.userRole == 'admin';

    final canReview = isSubmitted && isReviewer;
    final canApprove = isReviewed && isApprover;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: DCR Number, Doc Level & Status
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7C3AED).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    dcr.dcrNumber,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED)),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: levelCfg['bg'] as Color,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    dcr.docLevel,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: levelCfg['color'] as Color),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusCfg['bg'] as Color,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    statusCfg['label'] as String,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: statusCfg['color'] as Color),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Document Title & Number
            Text(
              dcr.documentTitle,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A)),
            ),
            Text(
              '${dcr.documentNumber} • ${dcr.existingRevision} ➔ ${dcr.proposedRevision} (${dcr.changeTypeDisplay})',
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),

            // Reason for change
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Reason: ${dcr.reasonForChange}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF334155)),
              ),
            ),

            if (dcr.status == 'rejected' && dcr.rejectedReason != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Rejected (${dcr.rejectionStage}): ${dcr.rejectedReason}',
                  style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                ),
              ),
            ],

            const SizedBox(height: 12),
            // Footer: Requestor & Actions
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Text(
                  'By ${dcr.requestorName}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
                const Spacer(),

                // Action buttons for Reviewer or Approver
                if (canReview)
                  ElevatedButton(
                    onPressed: () => DCRActionDialog.show(
                      context,
                      dcr: dcr,
                      actionType: 'review',
                      onSuccess: () {
                        _loadDcrs();
                        _loadUnreadCount();
                      },
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Review', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),

                if (canApprove)
                  ElevatedButton(
                    onPressed: () => DCRActionDialog.show(
                      context,
                      dcr: dcr,
                      actionType: 'approval',
                      onSuccess: () {
                        _loadDcrs();
                        _loadDocs();
                        _loadUnreadCount();
                      },
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Approve', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  Widget _buildEmpty(String msg) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.folder_open_rounded, size: 48, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              Text(
                'No records found',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 4),
              Text(msg, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
            ],
          ),
        ),
      );

  Widget _buildError(String err, VoidCallback onRetry) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, size: 44, color: Colors.red.shade300),
              const SizedBox(height: 12),
              Text(
                'Something went wrong',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.red.shade700),
              ),
              const SizedBox(height: 6),
              Text(err, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
              ),
            ],
          ),
        ),
      );
}
