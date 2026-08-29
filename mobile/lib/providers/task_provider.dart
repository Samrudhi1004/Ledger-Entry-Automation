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
    try {
      final success = await ApiService.acceptTask(taskId);
      if (success) {
        errorMessage = '';
        await fetchTasks();
      } else {
        errorMessage = 'Failed to accept task.';
      }
      notifyListeners();
      return success;
    } catch (e) {
      errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> completeTask(int taskId) async {
    try {
      final success = await ApiService.completeTask(taskId);
      if (success) {
        errorMessage = '';
        await fetchTasks();
      } else {
        errorMessage = 'Failed to complete task.';
      }
      notifyListeners();
      return success;
    } catch (e) {
      errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> flagIssue(int taskId, String issueDescription) async {
    try {
      final success = await ApiService.flagTaskIssue(taskId, issueDescription);
      if (success) {
        errorMessage = '';
        await fetchTasks();
      } else {
        errorMessage = 'Failed to flag issue.';
      }
      notifyListeners();
      return success;
    } catch (e) {
      errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }
}
