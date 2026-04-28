import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/injection_container.dart';

class JobCommentsPage extends StatefulWidget {
  final int jobId;
  final int initialCount;

  const JobCommentsPage({
    super.key,
    required this.jobId,
    required this.initialCount,
  });

  @override
  State<JobCommentsPage> createState() => _JobCommentsPageState();
}

class _JobCommentsPageState extends State<JobCommentsPage> {
  final Dio _dio = sl<Dio>();
  final TextEditingController _commentController = TextEditingController();
  final List<_JobComment> _comments = [];

  bool _loading = true;
  bool _posting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadComments() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await _dio.get(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.jobId}/comments',
      );
      final data = response.data['data'] as List<dynamic>? ?? [];
      final parsed = data.map((item) {
        final map = item as Map<String, dynamic>;
        final user = map['user'] as Map<String, dynamic>? ?? {};
        return _JobComment(
          id: map['id'] as int? ?? 0,
          content: map['content']?.toString() ?? '',
          userName: user['name']?.toString() ?? 'User',
          createdAt: map['created_at']?.toString() ?? '',
        );
      }).toList();

      if (!mounted) return;
      setState(() {
        _comments
          ..clear()
          ..addAll(parsed);
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error =
            e.response?.data?['message']?.toString() ??
            'Could not load comments';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load comments';
      });
    }
  }

  Future<void> _postComment() async {
    final content = _commentController.text.trim();
    if (content.isEmpty || _posting) return;

    setState(() => _posting = true);
    try {
      final response = await _dio.post(
        '${AppConstants.apiBaseUrl}/job-offers/${widget.jobId}/comments',
        data: {'content': content},
      );

      if (response.data['success'] == true) {
        _commentController.clear();
        await _loadComments();
      }
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.response?.data?['message']?.toString() ?? 'Failed to add comment',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _posting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.pop(context, _comments.length);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: Text(
            'Comments (${_comments.length})',
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          leading: IconButton(
            onPressed: () => Navigator.pop(context, _comments.length),
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: Color(0xFF0F172A),
              size: 19,
            ),
          ),
        ),
        body: Column(
          children: [
            Expanded(child: _buildBody()),
            SafeArea(
              top: false,
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _commentController,
                        minLines: 1,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Write a comment...',
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: Color(0xFF0A66C2),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _posting ? null : _postComment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F172A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _posting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Post'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 10),
            TextButton(onPressed: _loadComments, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_comments.isEmpty) {
      return const Center(
        child: Text(
          'No comments yet',
          style: TextStyle(color: Color(0xFF64748B)),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      itemCount: _comments.length,
      separatorBuilder: (_, _) => const Divider(height: 20),
      itemBuilder: (context, index) {
        final comment = _comments[index];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              comment.userName,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              comment.content,
              style: const TextStyle(color: Color(0xFF334155), height: 1.3),
            ),
            const SizedBox(height: 4),
            Text(
              _formatDatePosted(comment.createdAt),
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
            ),
          ],
        );
      },
    );
  }

  String _formatDatePosted(String raw) {
    final value = raw.trim();
    if (value.isEmpty) return 'Recently';
    final date = DateTime.tryParse(value);
    if (date == null) return 'Recently';
    final year = date.year.toString().padLeft(4, '0');
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }
}

class _JobComment {
  final int id;
  final String content;
  final String userName;
  final String createdAt;

  const _JobComment({
    required this.id,
    required this.content,
    required this.userName,
    required this.createdAt,
  });
}
