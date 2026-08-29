import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/task_provider.dart';


class TasksScreen extends StatefulWidget {
  const TasksScreen({Key? key}) : super(key: key);

  @override
  _TasksScreenState createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TaskProvider>(context, listen: false).fetchTasks();
    });
  }

  String _formatDate(DateTime dt) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final m = months[dt.month - 1];
    final d = dt.day.toString().padLeft(2, '0');
    final y = dt.year;
    final h = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$m $d, $y $h:$min';
  }

  void _showFlagIssueDialog(BuildContext context, int taskId) {
    final _controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Text('Flag Issue', style: TextStyle(color: Colors.white)),
          content: TextField(
            controller: _controller,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              hintText: 'Describe the issue...',
              hintStyle: TextStyle(color: Colors.white54),
              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.blueAccent)),
              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.blue)),
            ),
            maxLines: 3,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
            ),
            ElevatedButton(
              onPressed: () {
                if (_controller.text.trim().isNotEmpty) {
                  Provider.of<TaskProvider>(context, listen: false).flagIssue(taskId, _controller.text.trim());
                  Navigator.pop(context);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              child: const Text('Submit', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    final taskProvider = Provider.of<TaskProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('My Tasks'),
        backgroundColor: const Color(0xFF1E293B),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => taskProvider.fetchTasks(),
          )
        ],
      ),
      body: taskProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : taskProvider.tasks.isEmpty
              ? const Center(
                  child: Text('No tasks found.', style: TextStyle(color: Colors.white70, fontSize: 16)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: taskProvider.tasks.length,
                  itemBuilder: (context, index) {
                    final task = taskProvider.tasks[index];
                    final String status = task['status'] ?? 'pending';
                    Color statusColor = Colors.orange;
                    if (status == 'completed') statusColor = Colors.green;
                    if (status == 'flagged_issue') statusColor = Colors.red;
                    if (status == 'accepted') statusColor = Colors.blue;

                    DateTime? deadline;
                    if (task['deadline'] != null) {
                      deadline = DateTime.tryParse(task['deadline']);
                    }

                    return Card(
                      color: const Color(0xFF1E293B),
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    task['title'] ?? '',
                                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: statusColor)
                                  ),
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                )
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              task['description'] ?? '',
                              style: const TextStyle(color: Colors.white70),
                            ),
                            const SizedBox(height: 12),
                            if (deadline != null)
                              Row(
                                children: [
                                  const Icon(Icons.access_time, color: Colors.blueAccent, size: 16),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Due: ${_formatDate(deadline.toLocal())}',
                                    style: const TextStyle(color: Colors.blueAccent, fontSize: 13),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (status == 'pending') ...[
                                  TextButton(
                                    onPressed: () => _showFlagIssueDialog(context, task['id']),
                                    child: const Text('FLAG ISSUE', style: TextStyle(color: Colors.redAccent)),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () => taskProvider.acceptTask(task['id']),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                                    child: const Text('ACCEPT', style: TextStyle(color: Colors.white)),
                                  ),
                                ],
                                if (status == 'accepted') ...[
                                  TextButton(
                                    onPressed: () => _showFlagIssueDialog(context, task['id']),
                                    child: const Text('FLAG ISSUE', style: TextStyle(color: Colors.redAccent)),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: () => taskProvider.completeTask(task['id']),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                                    child: const Text('MARK COMPLETE', style: TextStyle(color: Colors.white)),
                                  ),
                                ],
                              ],
                            )
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
