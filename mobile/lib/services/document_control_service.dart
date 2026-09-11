import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class DocumentCategory {
  final int id;
  final String name;
  final String colorHex;
  final String description;

  DocumentCategory({
    required this.id,
    required this.name,
    required this.colorHex,
    required this.description,
  });

  factory DocumentCategory.fromJson(Map<String, dynamic> json) =>
      DocumentCategory(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        colorHex: json['color_hex'] as String? ?? '#6366f1',
        description: json['description'] as String? ?? '',
      );
}

class Document {
  final String id;
  final String documentNumber;
  final String title;
  final String description;
  final String status;
  final String revision;
  final String? categoryName;
  final String? categoryColor;
  final String? cloudinaryUrl;
  final String? fileName;
  final int? fileSize;
  final String? uploadedByName;
  final String? approvedByName;
  final String? effectiveDate;
  final String createdAt;

  Document({
    required this.id,
    required this.documentNumber,
    required this.title,
    required this.description,
    required this.status,
    required this.revision,
    this.categoryName,
    this.categoryColor,
    this.cloudinaryUrl,
    this.fileName,
    this.fileSize,
    this.uploadedByName,
    this.approvedByName,
    this.effectiveDate,
    required this.createdAt,
  });

  factory Document.fromJson(Map<String, dynamic> json) => Document(
        id: json['id'] as String,
        documentNumber: json['document_number'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        status: json['status'] as String? ?? 'draft',
        revision: json['revision'] as String? ?? 'Rev A',
        categoryName: json['category_name'] as String?,
        categoryColor: json['category_color'] as String?,
        cloudinaryUrl: json['cloudinary_url'] as String?,
        fileName: json['file_name'] as String?,
        fileSize: json['file_size'] as int?,
        uploadedByName: json['uploaded_by_name'] as String?,
        approvedByName: json['approved_by_name'] as String?,
        effectiveDate: json['effective_date'] as String?,
        createdAt: json['created_at'] as String? ?? '',
      );

  String get fileSizeDisplay {
    if (fileSize == null) return 'N/A';
    if (fileSize! < 1024) return '${fileSize} B';
    if (fileSize! < 1024 * 1024) return '${(fileSize! / 1024).toStringAsFixed(1)} KB';
    return '${(fileSize! / 1024 / 1024).toStringAsFixed(2)} MB';
  }
}

class DocumentActivity {
  final String action;
  final String performedByName;
  final String comment;
  final String timestamp;

  DocumentActivity({
    required this.action,
    required this.performedByName,
    required this.comment,
    required this.timestamp,
  });

  factory DocumentActivity.fromJson(Map<String, dynamic> json) =>
      DocumentActivity(
        action: json['action'] as String? ?? '',
        performedByName: json['performed_by_name'] as String? ?? 'Unknown',
        comment: json['comment'] as String? ?? '',
        timestamp: json['timestamp'] as String? ?? '',
      );
}

class DocumentControlService {
  static const String _baseUrl =
      String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  Future<Map<String, String>> _headers() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Fetch list of documents. Optionally filter by [search], [category], [status].
  Future<List<Document>> getDocuments({
    String? search,
    String? category,
    String? status,
  }) async {
    final queryParams = <String, String>{};
    if (search != null && search.isNotEmpty) queryParams['search'] = search;
    if (category != null && category.isNotEmpty) queryParams['category'] = category;
    if (status != null && status.isNotEmpty) queryParams['status'] = status;

    final uri = Uri.parse('$_baseUrl/api/document-control/documents/')
        .replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);

    final response = await http.get(uri, headers: await _headers());
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final list = data is List ? data : (data['results'] ?? []) as List;
      return list.map((e) => Document.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load documents: ${response.statusCode}');
  }

  /// Fetch a single document by [id].
  Future<Document> getDocumentById(String id) async {
    final uri = Uri.parse('$_baseUrl/api/document-control/documents/$id/');
    final response = await http.get(uri, headers: await _headers());
    if (response.statusCode == 200) {
      return Document.fromJson(json.decode(response.body) as Map<String, dynamic>);
    }
    throw Exception('Failed to load document: ${response.statusCode}');
  }

  /// Fetch activity log for a document.
  Future<List<DocumentActivity>> getDocumentHistory(String id) async {
    final uri = Uri.parse('$_baseUrl/api/document-control/documents/$id/history/');
    final response = await http.get(uri, headers: await _headers());
    if (response.statusCode == 200) {
      final list = json.decode(response.body) as List;
      return list.map((e) => DocumentActivity.fromJson(e as Map<String, dynamic>)).toList();
    }
    throw Exception('Failed to load history: ${response.statusCode}');
  }

  /// Fetch all categories.
  Future<List<DocumentCategory>> getCategories() async {
    final uri = Uri.parse('$_baseUrl/api/document-control/categories/');
    final response = await http.get(uri, headers: await _headers());
    if (response.statusCode == 200) {
      final list = json.decode(response.body) as List;
      return list
          .map((e) => DocumentCategory.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to load categories: ${response.statusCode}');
  }
}
