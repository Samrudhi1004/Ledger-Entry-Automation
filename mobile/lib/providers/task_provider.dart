import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class TaskProvider with ChangeNotifier {
  List<dynamic> tasks = [];
  bool isLoading = false;
  String errorMessage = '';

  Future<void> fetchTasks() async {
    isLoading = true;
    errorMessage = '';
    notifyListeners();
    try {
      tasks = await ApiService.getTasks();
    } catch (e) {
      errorMessage = e.toString();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> acceptTask(int taskId) async {
    final success = await ApiService.acceptTask(taskId);
    if (success) await fetchTasks();
    return success;
  }

  Future<bool> completeTask(int taskId) async {
    final success = await ApiService.completeTask(taskId);
    if (success) await fetchTasks();
    return success;
  }

  Future<bool> flagIssue(int taskId, String issueDescription) async {
    final success = await ApiService.flagTaskIssue(taskId, issueDescription);
    if (success) await fetchTasks();
    return success;
  }
}
