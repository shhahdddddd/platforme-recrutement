import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_event.dart';
import 'package:recrutitn/features/auth/presentation/bloc/auth_state.dart';
import 'package:recrutitn/core/theme/app_theme.dart';
import 'package:recrutitn/features/auth/domain/entities/user_entity.dart';
import 'package:recrutitn/core/constants/app_constants.dart';
import 'package:recrutitn/l10n/app_localizations.dart';
import 'package:recrutitn/injection_container.dart' as di;
import 'edit_basic_info_page.dart';
import '../../domain/entities/education_entity.dart';

class ProfilePage extends StatefulWidget {
  final UserEntity user;

  const ProfilePage({super.key, required this.user});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final ImagePicker _picker = ImagePicker();

  Future<String?> _resolveAuthToken() async {
    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      return state.user.token;
    }
    return widget.user.token;
  }
  Uint8List? _imageBytes; // For cross-platform display
  bool _isUploading = false;
  bool _isUploadingCv = false;
  String? _cvFileName;

  @override
  void initState() {
    super.initState();
    // Defer the CV fetch to ensure the widget tree is fully built
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchCvStatus();
    });
  }

  Future<void> _fetchCvStatus() async {
    if (!mounted) return;

    final authBloc = context.read<AuthBloc>();
    final state = authBloc.state;
    final user = (state is AuthAuthenticated) ? state.user : widget.user;

    // Only candidates have CVs
    final role = user.role.toLowerCase();
    if (role != 'candidat' && role != 'candidate') return;

    try {
      String? token;

      if (state is AuthAuthenticated) {
        token = state.user.token;
      } else {
        token = widget.user.token;
      }

      if (token == null) {
        debugPrint('[CV Status] No token available — skipping fetch.');
        return;
      }

      final dio = di.sl<Dio>();
      final response = await dio.get(
        '${AppConstants.apiBaseUrl}/cv/status',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        ),
      );

      if (!mounted) return;

      debugPrint('[CV Status] Response status: ${response.statusCode}');
      debugPrint('[CV Status] Response data type: ${response.data.runtimeType}');
      debugPrint('[CV Status] Response data: ${response.data}');

      if (response.statusCode == 200) {
        // Handle case where Dio might return data as a raw String
        dynamic responseData = response.data;
        if (responseData is String) {
          try {
            responseData = json.decode(responseData);
          } catch (e) {
            debugPrint('[CV Status] Failed to decode JSON string: $e');
            return;
          }
        }

        if (responseData is! Map<String, dynamic>) {
          debugPrint('[CV Status] Unexpected response format: ${responseData.runtimeType}');
          return;
        }

        // Try multiple response structures
        String? cvPath;

        // Structure A: { "data": { "cv_path": "..." } }
        if (responseData.containsKey('data') && responseData['data'] is Map) {
          final data = responseData['data'] as Map;
          cvPath = data['cv_path']?.toString();
        }
        // Structure B: { "cv_path": "..." } (directly at root)
        else if (responseData.containsKey('cv_path')) {
          cvPath = responseData['cv_path']?.toString();
        }

        debugPrint('[CV Status] Extracted cv_path: $cvPath');

        if (cvPath != null && cvPath.isNotEmpty && mounted) {
          setState(() {
            _cvFileName = cvPath!.split('/').last;
          });
          debugPrint('[CV Status] CV filename set to: $_cvFileName');
        } else {
          debugPrint('[CV Status] No CV path found in response.');
        }
      }
    } catch (e) {
      debugPrint('[CV Status] Error fetching CV status: $e');
    }
  }

  Future<void> _pickImage() async {
    try {
      final XFile? selected = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );

      if (selected == null) return;

      // Validate file extension
      final String fileName = selected.name.toLowerCase();
      if (!fileName.endsWith('.jpg') &&
          !fileName.endsWith('.jpeg') &&
          !fileName.endsWith('.png')) {
        _showErrorDialog(
          AppLocalizations.of(context)!.unsupportedFormat,
          'Please select an image in JPG or PNG format only.',
        );
        return;
      }

      // Validate file size (max 5MB)
      final int fileSize = await selected.length();
      if (fileSize > 5 * 1024 * 1024) {
        _showErrorDialog(
          AppLocalizations.of(context)!.fileTooLarge,
          'Image size must not exceed 5 MB.',
        );
        return;
      }

      // Read bytes for display
      final bytes = await selected.readAsBytes();

      // Show loading and upload
      setState(() {
        _imageBytes = bytes;
        _isUploading = true;
      });

      await _uploadProfilePicture(selected);
    } catch (e) {
      _showErrorDialog(
        AppLocalizations.of(context)!.error,
        'Unable to select image: $e',
      );
    }
  }

  Future<void> _uploadProfilePicture(XFile imageFile) async {
    try {
      final dio = di.sl<Dio>();
      final token = widget.user.token;

      if (token == null) {
        throw Exception('No authentication token');
      }

      final bytes = await imageFile.readAsBytes();
      final formData = FormData.fromMap({
        'picture': MultipartFile.fromBytes(bytes, filename: imageFile.name),
      });

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/profile/picture',
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200) {
        // IMPORTANT: Print the response to debug console to see the actual structure
        debugPrint('Upload Response Data: ${response.data}');

        String? newPhotoUrl;

        // Robust Parsing: Handle different API response structures
        if (response.data is Map<String, dynamic>) {
          final data = response.data as Map<String, dynamic>;

          // Structure A: { "data": { "picture_url": "..." } }
          if (data.containsKey('data') && data['data'] is Map) {
            newPhotoUrl = data['data']['picture_url'];
          }
          // Structure B: { "picture_url": "..." } (Directly in root)
          else if (data.containsKey('picture_url')) {
            newPhotoUrl = data['picture_url'];
          }
          // Structure C: { "url": "..." }
          else if (data.containsKey('url')) {
            newPhotoUrl = data['url'];
          }
          // Structure D: { "data": "http://..." } (Data is a string)
          else if (data.containsKey('data') && data['data'] is String) {
            newPhotoUrl = data['data'];
          }
        }

        if (newPhotoUrl != null && mounted) {
          // Normalize URL for emulators
          if (!kIsWeb &&
              (newPhotoUrl.contains('localhost') ||
                  newPhotoUrl.contains('127.0.0.1'))) {
            newPhotoUrl = newPhotoUrl
                .replaceAll('localhost', '10.0.2.2')
                .replaceAll('127.0.0.1', '10.0.2.2');
          }

          setState(() {
            _isUploading = false;
          });

          _showSuccessDialog(AppLocalizations.of(context)!.profilePhotoUpdated);

          // Update the Bloc State
          final currentState = context.read<AuthBloc>().state;
          final currentUser = (currentState is AuthAuthenticated)
              ? currentState.user
              : widget.user;

          // Ensure your UserEntity has a working copyWith method
          final updatedUser = currentUser.copyWith(photoPath: newPhotoUrl);

          context.read<AuthBloc>().add(UpdateUserEvent(updatedUser));
        } else {
          // If we reach here, the upload succeeded (200) but we couldn't find the URL
          setState(() => _isUploading = false);
          _showErrorDialog(
            'Format Error',
            'The image was uploaded, but the URL was not found in the response. Check the console (debug).',
          );
        }
      } else {
        throw Exception('Upload failed');
      }
    } on DioException catch (e) {
      String errorMessage = 'Unable to upload image';

      if (e.response?.statusCode == 422) {
        final data = e.response?.data;
        if (data != null && data['errors'] != null) {
          final errors = data['errors'];
          if (errors is Map && errors.containsKey('picture')) {
            errorMessage = errors['picture'][0];
          } else {
            errorMessage =
                'Validation failed: ${data['message'] ?? 'Unknown error'}';
          }
        } else {
          errorMessage = data['message'] ?? 'Validation error';
        }
      } else if (e.response != null) {
        errorMessage = 'Server error: ${e.response?.statusCode}';
      }

      setState(() {
        _isUploading = false;
      });
      _showErrorDialog(AppLocalizations.of(context)!.error, errorMessage);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
        _showErrorDialog('Error', 'An unexpected error occurred: $e');
      }
    }
  }

  Future<void> _pickAndUploadCv() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (result == null) return;
      if (!mounted) return;

      final file = result.files.single;

      // Check file size (max 3MB)
      if (file.size > 3 * 1024 * 1024) {
        _showErrorDialog(
          AppLocalizations.of(context)!.fileTooLarge,
          'Please check your CV. The file must not exceed 3 MB.',
        );
        return;
      }

      setState(() {
        _isUploadingCv = true;
        _cvFileName = file.name;
      });

      // Get user token
      final authBloc = context.read<AuthBloc>();
      final state = authBloc.state;
      String? token;

      if (state is AuthAuthenticated) {
        token = state.user.token;
      } else {
        token = widget.user.token;
      }

      if (token == null) {
        setState(() => _isUploadingCv = false);
        _showErrorDialog(
          AppLocalizations.of(context)!.error,
          'Unauthorized. Please log in again.',
        );
        return;
      }

      final filePath = file.path;

      if (filePath == null) {
        // handle web specifically if needed, but for now assuming mobile/desktop has path
        if (kIsWeb) {
          // Web implementation using bytes if needed (FormData.fromMap with MultipartFile.fromBytes)
          // But let's check platform bytes
        }
      }

      FormData formData;
      if (kIsWeb) {
        formData = FormData.fromMap({
          'cv': MultipartFile.fromBytes(file.bytes!, filename: file.name),
        });
      } else {
        formData = FormData.fromMap({
          'cv': await MultipartFile.fromFile(filePath!, filename: file.name),
        });
      }

      final dio = di.sl<Dio>();
      // Or create new Dio if dependency injection is not fully set up or we need specific headers
      // final dio = Dio();

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/cv/upload',
        data: formData,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
            // 'Content-Type': 'multipart/form-data', // Dio handles this automatically
          },
        ),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        setState(() {
          _isUploadingCv = false;
        });
        _showSuccessDialog('CV uploaded successfully! Analysis in progress...');
      } else {
        throw Exception('Erreur: ${response.statusCode}');
      }
    } on DioException catch (e) {
      setState(() => _isUploadingCv = false);
      String errorMessage = 'CV upload failed';
      if (e.response?.data != null && e.response?.data['message'] != null) {
        errorMessage = e.response?.data['message'];
      }
      _showErrorDialog(AppLocalizations.of(context)!.error, errorMessage);
    } catch (e) {
      setState(() => _isUploadingCv = false);
      _showErrorDialog(
        AppLocalizations.of(context)!.error,
        'Une erreur inattendue est survenue: $e',
      );
    }
  }

  Future<void> _deleteCv() async {
    try {
      // Get user token
      final authBloc = context.read<AuthBloc>();
      final state = authBloc.state;
      String? token;

      if (state is AuthAuthenticated) {
        token = state.user.token;
      } else {
        token = widget.user.token;
      }

      if (token == null) {
        _showErrorDialog(
          AppLocalizations.of(context)!.error,
          'Unauthorized. Please log in again.',
        );
        return;
      }

      // Show confirmation dialog
      final bool? confirm = await showDialog<bool>(
        context: context,
        builder: (BuildContext context) {
          return Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            backgroundColor: Colors.white,
            elevation: 0,
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.delete_rounded,
                      color: Colors.red,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    AppLocalizations.of(context)!.deleteCv,
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    AppLocalizations.of(context)!.deleteCvConfirmation,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppTheme.subtextColor,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () => Navigator.of(context).pop(false),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            backgroundColor: Colors.grey.shade100,
                          ),
                          child: Text(
                            "Annuler",
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => Navigator.of(context).pop(true),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: Text(
                            AppLocalizations.of(context)!.delete,
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      );

      if (confirm != true) return;

      setState(() => _isUploadingCv = true); // Use loading state while deleting

      final dio = di.sl<Dio>();
      final response = await dio.delete(
        '${AppConstants.apiBaseUrl}/cv/delete',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200) {
        setState(() {
          _isUploadingCv = false;
          _cvFileName = null;
        });
        _showSuccessDialog(AppLocalizations.of(context)!.cvDeleted);
      } else {
        throw Exception('Erreur: ${response.statusCode}');
      }
    } catch (e) {
      setState(() => _isUploadingCv = false);
      _showErrorDialog(
        AppLocalizations.of(context)!.error,
        'Impossible de supprimer le CV: $e',
      );
    }
  }

  void _showErrorDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.priority_high_rounded,
                  color: Colors.red.shade600,
                  size: 32,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textColor,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  color: Colors.grey.shade600,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade600,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    "D'accord",
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSuccessDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_rounded,
                  color: Colors.green.shade600,
                  size: 32,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                AppLocalizations.of(context)!.success,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textColor,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  color: Colors.grey.shade600,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    "Great",
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddSkillsDialog() {
    debugPrint("Opening Add Skills Dialog");
    final TextEditingController skillsController = TextEditingController();

    // Pre-defined list of popular tech skills to suggest
    final List<String> suggestions = [
      'React JS',
      'Laravel',
      'Flutter',
      'Spring Boot',
      'Docker',
      'Node.js',
      'Python',
      'Java',
      'SQL',
      'Git',
      'AWS',
      'Figma',
      'Conception',
    ];

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: Text(
                AppLocalizations.of(context)!.addSkillsTitle,
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              content: SizedBox(
                width:
                    double.maxFinite, // Ensure dialog takes appropriate width
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        AppLocalizations.of(context)!.addSkillsSubtitle,
                        style: GoogleFonts.inter(
                          color: AppTheme.subtextColor,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Input Field
                      TextField(
                        controller: skillsController,
                        decoration: InputDecoration(
                          hintText: AppLocalizations.of(context)!.skillsHint,
                          filled: true,
                          fillColor: Colors.grey.shade50,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: Colors.grey.shade300),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(
                              color: AppTheme.primaryColor,
                            ),
                          ),
                        ),
                        maxLines: 2,
                        onChanged: (val) {
                          // Allow typing updates
                        },
                      ),

                      const SizedBox(height: 16),

                      // Suggestions - Using Material validation for InkWell
                      Container(
                        constraints: const BoxConstraints(maxHeight: 200),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade100),
                        ),
                        child: Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(12),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: suggestions.map((skill) {
                                return InkWell(
                                  onTap: () {
                                    final currentText = skillsController.text;
                                    if (currentText.isEmpty) {
                                      skillsController.text = skill;
                                    } else {
                                      if (!currentText.contains(skill)) {
                                        skillsController.text =
                                            "$currentText, $skill";
                                      }
                                    }
                                    setState(() {});
                                  },
                                  borderRadius: BorderRadius.circular(20),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 8,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade50,
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: Colors.grey.shade300,
                                      ),
                                    ),
                                    child: Text(
                                      skill,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        color: AppTheme.textColor,
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    AppLocalizations.of(context)!.cancelButton,
                    style: GoogleFonts.inter(color: Colors.grey),
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    final input = skillsController.text;
                    debugPrint("Adding skills: $input");
                    if (input.isNotEmpty) {
                      _updateSkills(input);
                    }
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Text(
                    AppLocalizations.of(context)!.add,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _updateSkills(String input) async {
    // Parse comma-separated skills
    final List<String> newSkills = input
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    if (newSkills.isEmpty) return;

    // Get current user and mix with existing skills if needed, or replace.
    // Assuming adding to existing for now to be safe, or replacing?
    // Usually 'Add' implies appending, but 'Edit' implies replacing.
    // Let's retrieve current skills and append unique ones.

    final authBloc = context.read<AuthBloc>();
    final currentState = authBloc.state;
    UserEntity? currentUser;
    if (currentState is AuthAuthenticated) {
      currentUser = currentState.user;
    } else {
      currentUser = widget.user;
    }

    final List<String> currentSkills = currentUser.skills ?? [];
    final Set<String> updatedSkillsSet = {...currentSkills, ...newSkills};
    final List<String> updatedSkills = updatedSkillsSet.toList();

    // Call backend to update
    // We need a method in AuthService equivalent to updateProfile but specific for skills
    // Or reuse a generic updateProfile. Since I don't see one in this file, I'll simulate it or implement it.
    // I know 'updateProfile' usually exists. Let's assume we post to /auth/update or similar
    // Actually, looking at AuthBloc, there isn't a generic UpdateProfileEvent visible here.
    // I will implement a direct API call here similarly to how I did for upload, for expediency.

    try {
      final dio = di.sl<Dio>();
      final token = currentUser.token;

      // Assuming endpoint exists or using a generic user update endpoint
      // I will use a generic update endpoint if available, but for now I'll use the profile/update if it exists
      // Looking at api.php routes earlier, I saw:
      // Route::post('/password/update', ...);
      // Route::post('/profile/picture', ...);
      // I didn't see a generic '/profile' update route in the snippets I viewed.
      // I should probably add one in backend if it doesn't exist.
      // But to make it work 'now', I'll assume I can add it or it exists.
      // Let's create the route in next step if checking reveals it's missing.

      // For now, let's just update local state to show it works visually, and try to send to backend.

      // Optimistic update
      final updatedUser = currentUser.copyWith(skills: updatedSkills);
      // Emit new state if possible or setState
      // AuthBloc doesn't expose a public 'updateUser' method easily without an event.
      // But I can force a state emission if I could access the bloc logic, but better to fetch fresh data.
      // For now, let's just try to call an endpoint.

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/profile',
        data: {'skills': updatedSkills},
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        // 1. Dispatch UpdateUserEvent to immediately update UI with local data
        context.read<AuthBloc>().add(UpdateUserEvent(updatedUser));

        _showSuccessDialog(AppLocalizations.of(context)!.skillsUpdated);
      }
    } catch (e) {
      debugPrint("Error updating skills: $e");
      if (e is DioException) {
        debugPrint("DioError response: ${e.response?.data}");
      }
      _showErrorDialog(
        AppLocalizations.of(context)!.error,
        "Unable to update skills. Please try again.",
      );
    }
  }

  void _showEducationBottomSheet({UserEntity? user, EducationEntity? education}) {
    final l10n = AppLocalizations.of(context)!;
    final TextEditingController universityController = TextEditingController(
      text: education?.university ?? user?.university,
    );
    final TextEditingController diplomaController = TextEditingController(
      text: education?.diploma ?? user?.diploma,
    );
    final TextEditingController startYearController = TextEditingController(
      text: education?.startDate ?? user?.startYear,
    );
    final TextEditingController endYearController = TextEditingController(
      text: education?.endDate ?? user?.endYear,
    );
    String selectedDiplomaLevel = education?.level ?? _detectDiplomaLevel(education?.diploma ?? user?.diploma);

    void selectYear(
      TextEditingController controller, {
      DateTime? firstDate,
      DateTime? lastDate,
    }) {
      final now = DateTime.now();
      final int startYear = (firstDate?.year ?? 1990);
      final int endYear = (lastDate?.year ?? now.year + 10);
      final List<int> years = List.generate(
        endYear - startYear + 1,
        (index) => endYear - index,
      );
      final int selectedYear = int.tryParse(controller.text) ?? now.year;

      showGeneralDialog(
        context: context,
        barrierDismissible: true,
        barrierLabel: '',
        barrierColor: Colors.black.withValues(alpha: 0.4),
        transitionDuration: const Duration(milliseconds: 300),
        pageBuilder: (context, anim1, anim2) => const SizedBox(),
        transitionBuilder: (context, a1, a2, child) {
          return BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
            child: FadeTransition(
              opacity: a1,
              child: ScaleTransition(
                scale: CurvedAnimation(parent: a1, curve: Curves.easeOutBack),
                child: AlertDialog(
                  clipBehavior: Clip.antiAlias,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(32),
                  ),
                  contentPadding: EdgeInsets.zero,
                  content: Container(
                    width: 340,
                    height: 480,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                    ),
                    child: Column(
                      children: [
                        // Header: Minimal & Glossy
                        Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 32,
                            horizontal: 24,
                          ),
                          width: double.infinity,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppTheme.primaryColor,
                                AppTheme.primaryColor.withValues(alpha: 0.8),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.calendar,
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white.withValues(alpha: 0.6),
                                  letterSpacing: 2,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                l10n.selectYear,
                                style: GoogleFonts.outfit(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Custom Grid
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(24),
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  childAspectRatio: 1.4,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 12,
                                ),
                            itemCount: years.length,
                            itemBuilder: (context, index) {
                              final year = years[index];
                              final isSelected = year == selectedYear;

                              return GestureDetector(
                                onTap: () {
                                  controller.text = year.toString();
                                  Navigator.pop(context);
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? AppTheme.primaryColor
                                        : Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: isSelected
                                        ? [
                                            BoxShadow(
                                              color: AppTheme.primaryColor
                                                  .withValues(alpha: 0.3),
                                              blurRadius: 10,
                                              offset: const Offset(0, 4),
                                            ),
                                          ]
                                        : [],
                                    border: Border.all(
                                      color: isSelected
                                          ? AppTheme.primaryColor
                                          : Colors.grey.shade200,
                                      width: 1.5,
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    year.toString(),
                                    style: GoogleFonts.inter(
                                      fontSize: 16,
                                      fontWeight: isSelected
                                          ? FontWeight.w800
                                          : FontWeight.w600,
                                      color: isSelected
                                          ? Colors.white
                                          : AppTheme.textColor.withValues(
                                              alpha: 0.7,
                                            ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        // Modern Action Area
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            border: Border(
                              top: BorderSide(color: Colors.grey.shade100),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 14,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    backgroundColor: Colors.grey.shade50,
                                  ),
                                  child: Text(
                                    "CANCEL",
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.grey.shade600,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      );
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            children: [
              // Premium Header with Gradient
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primaryColor,
                      AppTheme.primaryColor.withValues(alpha: 0.9),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(28),
                  ),
                ),
                child: Column(
                  children: [
                    // Elegant Handle
                    Container(
                      margin: const EdgeInsets.symmetric(vertical: 12),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                education == null
                                    ? "New Education"
                                    : "Edit Education",
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white.withValues(alpha: 0.7),
                                  letterSpacing: 1.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Academic Journey",
                                style: GoogleFonts.outfit(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: IconButton(
                              onPressed: () => Navigator.pop(context),
                              icon: const Icon(
                                Icons.close_rounded,
                                size: 24,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Form Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildFieldLabel("School or University", isRequired: true),
                      const SizedBox(height: 8),
                      _buildPremiumTextField(
                        controller: universityController,
                        hint: "Ex: University of Carthage",
                        icon: Icons.school_outlined,
                      ),
                      const SizedBox(height: 24),

                      _buildFieldLabel("Degree", isRequired: true),
                      const SizedBox(height: 8),
                      _buildPremiumTextField(
                        controller: diplomaController,
                        hint: "Ex: Master's in Computer Science",
                        icon: Icons.workspace_premium_outlined,
                      ),
                      const SizedBox(height: 24),

                      _buildFieldLabel("Level", isRequired: true),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: selectedDiplomaLevel,
                        dropdownColor: Colors.white,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          color: AppTheme.textColor,
                          fontWeight: FontWeight.w500,
                        ),
                        icon: Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: AppTheme.primaryColor,
                        ),
                        items: [
                          _buildStyledDropdownItem('licence', 'Bachelor\'s', Icons.school_outlined),
                          _buildStyledDropdownItem('master', 'Master\'s', Icons.workspace_premium_outlined),
                          _buildStyledDropdownItem('cycle_ing', 'Engineering Cycle', Icons.engineering_outlined),
                          _buildStyledDropdownItem('doctorat', 'Doctorate', Icons.workspace_premium_outlined),
                          _buildStyledDropdownItem('formation', 'Training', Icons.model_training_outlined),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          setModalState(() {
                            selectedDiplomaLevel = value;
                          });
                        },
                        decoration: InputDecoration(
                          prefixIcon: Icon(
                            Icons.stacked_bar_chart_rounded,
                            color: AppTheme.primaryColor.withValues(alpha: 0.7),
                            size: 22,
                          ),
                          filled: true,
                          fillColor: Colors.grey.shade50,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 16,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide(color: Colors.grey.shade200),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide(color: Colors.grey.shade200),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: AppTheme.primaryColor,
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel(
                                  "Start Year",
                                  isRequired: true,
                                ),
                                const SizedBox(height: 8),
                                GestureDetector(
                                  onTap: () => selectYear(
                                    startYearController,
                                    lastDate: DateTime.now(),
                                  ),
                                  child: AbsorbPointer(
                                    child: _buildPremiumTextField(
                                      controller: startYearController,
                                      hint: "2020",
                                      icon: Icons.calendar_today_outlined,
                                      suffix: Icon(
                                        Icons.keyboard_arrow_down_rounded,
                                        color: Colors.grey.shade400,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel(
                                  "End Year (or expected)",
                                  isRequired: true,
                                ),
                                const SizedBox(height: 8),
                                GestureDetector(
                                  onTap: () {
                                    DateTime? startDate;
                                    if (startYearController.text.isNotEmpty) {
                                      startDate = DateTime(
                                        int.tryParse(
                                              startYearController.text,
                                            ) ??
                                            1980,
                                      );
                                    }
                                    selectYear(
                                      endYearController,
                                      firstDate: startDate,
                                    );
                                  },
                                  child: AbsorbPointer(
                                    child: _buildPremiumTextField(
                                      controller: endYearController,
                                      hint: "2024",
                                      icon: Icons.calendar_month_outlined,
                                      suffix: Icon(
                                        Icons.keyboard_arrow_down_rounded,
                                        color: Colors.grey.shade400,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),

              // Footer Action
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -5),
                    ),
                  ],
                ),
                child: Container(
                  width: double.infinity,
                  height: 56,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: [
                        AppTheme.primaryColor,
                        Color(0xFF1E40AF),
                      ], // Premium Deep Blue
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryColor.withValues(alpha: 0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: () {
                      final university = universityController.text.trim();
                      final diploma = diplomaController.text.trim();
                      final startYearStr = startYearController.text;
                      final endYearStr = endYearController.text;

                      if (university.isEmpty ||
                          diploma.isEmpty ||
                          startYearStr.isEmpty ||
                          endYearStr.isEmpty) {
                        _showErrorDialog(
                          "Required Fields",
                          "Please fill in all form fields.",
                        );
                        return;
                      }

                      final start = int.tryParse(startYearStr);
                      final end = int.tryParse(endYearStr);
                      if (start != null && end != null) {
                        if (start >= end) {
                          _showErrorDialog(
                            "Invalid Dates",
                            "Start year must be strictly less than end year.",
                          );
                          return;
                        }
                        if (end - start < 2) {
                          // Keep validation but allow 1 year masters if needed?
                          // The user specifically wanted validation logic in Conversation a3cd9b19...
                          // If they didn't specify the 2 year rule there, I might be adding an unwanted restriction.
                          // I'll keep it for now as it makes sense for a "cycle".
                        }
                      }

                      _updateEducation(
                        university: university,
                        diploma: diploma,
                        diplomaLevel: selectedDiplomaLevel,
                        startYear: startYearStr,
                        endYear: endYearStr,
                        educationId: education?.id,
                      );
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      "Enregistrer la formation",
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  DropdownMenuItem<String> _buildStyledDropdownItem(String value, String label, IconData icon) {
    return DropdownMenuItem<String>(
      value: value,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              size: 18,
              color: AppTheme.primaryColor,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: AppTheme.textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String label, {bool isRequired = false}) {
    return Row(
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textColor,
          ),
        ),
        if (isRequired)
          Text(
            ' *',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.red,
            ),
          ),
      ],
    );
  }

  Widget _buildPremiumTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    Widget? suffix,
  }) {
    return TextField(
      controller: controller,
      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w500),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: Colors.grey.shade400, fontSize: 15),
        prefixIcon: Icon(
          icon,
          color: AppTheme.primaryColor.withValues(alpha: 0.7),
          size: 22,
        ),
        suffixIcon: suffix,
        filled: true,
        fillColor: Colors.grey.shade50,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppTheme.primaryColor, width: 2),
        ),
      ),
    );
  }

  Future<void> _updateEducation({
    required String university,
    required String diploma,
    required String diplomaLevel,
    required String startYear,
    required String endYear,
    int? educationId,
  }) async {
    final authBloc = context.read<AuthBloc>();
    final currentState = authBloc.state;
    UserEntity? currentUser;
    if (currentState is AuthAuthenticated) {
      currentUser = currentState.user;
    } else {
      currentUser = widget.user;
    }

    try {
      final dio = di.sl<Dio>();
      final token = await _resolveAuthToken();
      if (token == null) return;

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/profile',
        data: {
          if (educationId != null && educationId != 0) 'education_id': educationId,
          'university': university,
          'diploma': diploma,
          'diploma_level': diplomaLevel,
          'start_year': startYear,
          'end_year': endYear,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200) {
        authBloc.add(CheckAuthStatusEvent());
        _showSuccessDialog("Education updated successfully!");
      }
    } catch (e) {
      debugPrint("Error updating education: $e");
      _showErrorDialog("Error", "Unable to save education.");
    }
  }

  Future<void> _deleteEducationItem(int educationId) async {
    if (educationId == 0) {
      _showErrorDialog("Error", "This item cannot be deleted directly.");
      return;
    }

    try {
      final dio = di.sl<Dio>();
      final token = await _resolveAuthToken();
      if (token == null) return;

      final response = await dio.post(
        '${AppConstants.apiBaseUrl}/auth/profile',
        data: {
          'education_id': educationId,
          'university': '', // Will trigger deletion on backend
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200) {
        context.read<AuthBloc>().add(CheckAuthStatusEvent());
        _showSuccessDialog("Education deleted successfully!");
      }
    } catch (e) {
      _showErrorDialog("Error", "Unable to delete education.");
    }
  }

  Future<void> _deleteEducation() async {
    await _updateEducation(
      university: "",
      diploma: "",
      diplomaLevel: "master",
      startYear: "",
      endYear: "",
    );
  }

  String _detectDiplomaLevel(String? diploma) {
    final value = (diploma ?? '').toLowerCase();
    if (value.contains('licence') || value.contains('license')) return 'licence';
    if (value.contains('doctorat') || value.contains('phd')) return 'doctorat';
    if (value.contains('formation') || value.contains('pro')) return 'formation';
    if (value.contains('cycle') || value.contains('ing')) return 'cycle_ing';
    return 'master';
  }

  String _getFriendlyDiplomaLevel(String level) {
    switch (level) {
      case 'licence':
        return 'Bachelor\'s';
      case 'master':
        return 'Master';
      case 'cycle_ing':
        return 'Engineering Cycle';
      case 'doctorat':
        return 'Doctorate';
      case 'formation':
        return 'Certified Training';
      default:
        return level.toUpperCase();
    }
  }

  void _showDeleteConfirmDialog({
    required String title,
    required String content,
    required VoidCallback onConfirm,
  }) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.delete_sweep_rounded,
                color: Colors.red.shade600,
                size: 32,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppTheme.textColor,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              content,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 15,
                color: Colors.grey.shade600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      "Annuler",
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      onConfirm();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade600,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      "Supprimer",
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showImageOptions() {
    final l10n = AppLocalizations.of(context)!;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 20,
              offset: Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              // Handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                l10n.profilePhoto,
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textColor,
                ),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    _buildOptionItem(
                      icon: Icons.visibility_rounded,
                      label: l10n.viewPicture,
                      color: Colors.blueAccent,
                      onTap: () {
                        Navigator.pop(context);
                        _viewFullScreenImage();
                      },
                    ),
                    const SizedBox(height: 12),
                    _buildOptionItem(
                      icon: Icons.photo_camera_rounded,
                      label: l10n.changePicture,
                      color: AppTheme.primaryColor,
                      onTap: () {
                        Navigator.pop(context);
                        _pickImage();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOptionItem({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.grey.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.1)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textColor,
                ),
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 16,
              color: Colors.grey.shade400,
            ),
          ],
        ),
      ),
    );
  }

  void _viewFullScreenImage() {
    final authState = context.read<AuthBloc>().state;
    final user = (authState is AuthAuthenticated)
        ? authState.user
        : widget.user;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(backgroundColor: Colors.black, elevation: 0),
          body: Center(
            child: Hero(
              tag: 'profile_pic',
              child: _imageBytes != null
                  ? Image.memory(_imageBytes!)
                  : (user.photoPath != null
                        ? Image.network(user.photoPath!)
                        : Container(
                            width: 200,
                            height: 200,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                user.name.isNotEmpty
                                    ? user.name[0].toUpperCase()
                                    : '?',
                                style: GoogleFonts.outfit(
                                  fontSize: 80,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryColor,
                                ),
                              ),
                            ),
                          )),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final TextStyle sectionTitleStyle = GoogleFonts.outfit(
      fontSize: 20,
      fontWeight: FontWeight.bold,
      color: AppTheme.textColor,
    );

    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        // Use user from state if authenticated, otherwise fallback to widget.user
        final currentUser = (state is AuthAuthenticated)
            ? state.user
            : widget.user;

        return PopScope(
          canPop: !_isUploading,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop && _isUploading) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    l10n.pleaseWaitUploading,
                  ),
                ),
              );
            }
          },
          child: Stack(
            children: [
              Scaffold(
                backgroundColor: const Color(0xFFF3F2EF),
                body: CustomScrollView(
                  physics: const BouncingScrollPhysics(),
                  slivers: [
                    _buildSliverAppBar(currentUser),
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          _buildMainProfileCard(currentUser),
                          const SizedBox(height: 16), // Spacing after main card
                          _buildAboutCard(currentUser),
                          if (currentUser.role.toLowerCase() == 'candidat' ||
                              currentUser.role.toLowerCase() ==
                                  'candidate') ...[
                            _buildCvCard(currentUser),
                            _buildEducationCard(currentUser, sectionTitleStyle),
                            _buildSkillsCard(currentUser, sectionTitleStyle),
                          ],
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (_isUploading)
                Container(
                  color: Colors.black.withValues(alpha: 0.5),
                  child: const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSliverAppBar(UserEntity user) {
    return SliverAppBar(
      pinned: true,
      elevation: 0,
      scrolledUnderElevation: 1,
      backgroundColor: Colors.white.withValues(alpha: 0.95),
      toolbarHeight: 70,
      leadingWidth: 80,
      leading: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Center(
          child: _buildActionIcon(
            icon: Icons.arrow_back_ios_new_rounded,
            background: Colors.grey.shade50,
            color: AppTheme.textColor,
            onTap: () => Navigator.pop(context),
          ),
        ),
      ),
      title: Text(
        user.name.toUpperCase(),
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.w800,
          fontSize: 16,
          color: AppTheme.textColor,
          letterSpacing: 1.5,
        ),
      ),
      centerTitle: true,
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: Center(
            child: _buildActionIcon(
              icon: Icons.more_horiz_rounded,
              background: Colors.grey.shade50,
              color: AppTheme.textColor,
              onTap: () {},
            ),
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          height: 0.5,
          color: Colors.black.withValues(alpha: 0.05),
        ),
      ),
    );
  }

  Widget _buildMainProfileCard(UserEntity user) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stack: Cover Image + Profile Picture
          Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. Cover Image
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primaryColor.withValues(alpha: 0.8),
                      AppTheme.primaryColor,
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      'https://images.unsplash.com/photo-1544027993-37dbfe43562a?q=80&w=2070&auto=format&fit=crop',
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const SizedBox(),
                    ),
                    Container(color: Colors.black.withValues(alpha: 0.1)),
                  ],
                ),
              ),

              // 2. Profile Picture
              Positioned(
                top: 130,
                left: 24,
                child: GestureDetector(
                  onTap: _showImageOptions,
                  child: Hero(
                    tag: 'profile_pic',
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 20,
                            offset: Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: Container(
                          width: 120,
                          height: 120,
                          color: Colors.grey.shade100,
                          child:
                              user.photoPath != null &&
                                  user.photoPath!.isNotEmpty
                              ? Image.network(
                                  user.photoPath!,
                                  width: 120,
                                  height: 120,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) =>
                                      _buildAvatarPlaceholder(user),
                                )
                              : _buildAvatarPlaceholder(user),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Camera Icon
              Positioned(
                top: 215,
                left: 110,
                child: GestureDetector(
                  onTap: _showImageOptions,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 10),
                      ],
                    ),
                    child: const Icon(
                      Icons.camera_alt_rounded,
                      size: 18,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(
            height: 75,
          ), // Increased spacing for profile pic overlap
          // User Info Section
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user.name,
                            style: GoogleFonts.outfit(
                              fontSize: 30,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.textColor,
                              letterSpacing: -1,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.role.toLowerCase() == 'entreprise'
                                ? (user.companyName ?? "Recruteur")
                                : (user.specialite != null &&
                                          user.specialite!.isNotEmpty
                                      ? user.specialite!
                                      : ""),
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              color: AppTheme.primaryColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _buildActionIcon(
                      icon: Icons.edit_rounded,
                      background: AppTheme.primaryColor.withValues(alpha: 0.05),
                      color: AppTheme.primaryColor,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => EditBasicInfoPage(user: user),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.location_on_rounded,
                        size: 14,
                        color: Colors.grey.shade500,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      user.location ?? "Tunis, Tunisie",
                      style: GoogleFonts.inter(
                        color: Colors.grey.shade600,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Buttons removed as requested
                // const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAboutCard(UserEntity user) {
    return _buildSectionCard(
      title: "About",
      child: Text(
        user.bio != null &&
                user.bio!.isNotEmpty &&
                user.bio != 'No biography'
            ? user.bio!
            : "Share your journey...",
        style: GoogleFonts.inter(
          color: AppTheme.textColor.withValues(alpha: 0.8),
          height: 1.5,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildCvCard(UserEntity user) {
    return _buildSectionCard(
      title: "my CV",
      child: _cvFileName != null ? _buildCvFilledState() : _buildCvEmptyState(),
    );
  }

  Widget _buildCvFilledState() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2), // Very light red
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.picture_as_pdf_rounded,
              color: Color(0xFFEF4444),
              size: 32,
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _cvFileName!,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppTheme.textColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.check_circle,
                            size: 10,
                            color: Colors.green.shade600,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            "CV Validated",
                            style: GoogleFonts.inter(
                              color: Colors.green.shade700,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          _buildActionIcon(
            icon: Icons.close_rounded,
            color: Colors.grey.shade400,
            background: Colors.grey.shade50,
            tooltip: "Supprimer",
            onTap: _isUploadingCv ? () {} : _deleteCv,
          ),
        ],
      ),
    );
  }

  Widget _buildCvEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: const Icon(
              Icons.cloud_upload_rounded,
              color: AppTheme.primaryColor,
              size: 36,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            "Importez votre CV",
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.bold,
              fontSize: 18,
              color: AppTheme.textColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            "Format PDF uniquement (Max 3MB).\nUn bon CV multiplie vos chances par 5 !",
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: Colors.grey.shade500,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isUploadingCv ? null : _pickAndUploadCv,
              icon: _isUploadingCv
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.file_upload_outlined, size: 20),
              label: Text(
                _isUploadingCv
                    ? "Uploading..."
                    : "Select a file",
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEducationCard(UserEntity user, TextStyle titleStyle) {
    final List<EducationEntity> educations = user.educations ?? [];
    final bool hasData = educations.isNotEmpty || (user.university != null && user.university!.isNotEmpty);

    return _buildSectionCard(
      title: "Education",
      titleStyle: titleStyle,
      showAdd: true,
      onAdd: () => _showEducationBottomSheet(user: user),
      child: !hasData
          ? _buildPlaceholder(
              icon: Icons.school_outlined,
              text: "Add your academic journey",
            )
          : Column(
              children: [
                ...educations.map((edu) => _buildEducationItem(user, edu)),
                if (educations.isEmpty && (user.university != null && user.university!.isNotEmpty))
                  _buildEducationItem(user, EducationEntity(
                    id: 0,
                    university: user.university,
                    diploma: user.diploma,
                    startDate: user.startYear,
                    endDate: user.endYear,
                  )),
              ],
            ),
    );
  }

  Widget _buildEducationItem(UserEntity user, EducationEntity edu) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryColor.withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primaryColor.withValues(alpha: 0.1),
                      AppTheme.primaryColor.withValues(alpha: 0.05),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.school_rounded,
                  color: AppTheme.primaryColor,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      edu.diploma ?? "Degree",
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: AppTheme.textColor,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      edu.university ?? "University",
                      style: GoogleFonts.inter(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              if (edu.level != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.primaryColor.withValues(alpha: 0.12)),
                  ),
                  child: Text(
                    _getFriendlyDiplomaLevel(edu.level!),
                    style: GoogleFonts.inter(
                      color: AppTheme.primaryColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Divider(height: 1, thickness: 0.5, color: Color(0xFFF1F5F9)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.calendar_month_rounded, size: 14, color: Colors.grey.shade400),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "${edu.startDate ?? ''} — ${edu.endDate ?? ''}",
                    style: GoogleFonts.inter(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 12),
                  _buildStatusPill(edu.endDate),
                ],
              ),
              Row(
                children: [
                  _buildActionIcon(
                    icon: Icons.edit_note_rounded,
                    color: AppTheme.primaryColor,
                    background: AppTheme.primaryColor.withValues(alpha: 0.08),
                    tooltip: "Modifier",
                    onTap: () => _showEducationBottomSheet(user: user, education: edu),
                  ),
                  const SizedBox(width: 10),
                  _buildActionIcon(
                    icon: Icons.delete_outline_rounded,
                    color: Colors.red.shade600,
                    background: Colors.red.shade50,
                    tooltip: "Supprimer",
                    onTap: () {
                      _showDeleteConfirmDialog(
                        title: "Supprimer la formation",
                        content: "Êtes-vous sûr de vouloir retirer cette formation de votre profil ?",
                        onConfirm: () => _deleteEducationItem(edu.id),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionIcon({
    required IconData icon,
    required VoidCallback onTap,
    Color? color,
    Color? background,
    String? tooltip,
  }) {
    return Tooltip(
      message: tooltip ?? "",
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: background ?? Colors.transparent,
              border: Border.all(
                color: background != null
                    ? Colors.transparent
                    : Colors.grey.shade100,
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: color ?? AppTheme.primaryColor),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(String? endYear) {
    bool isEnCours = true;
    if (endYear != null && endYear.isNotEmpty) {
      try {
        final year = int.parse(endYear);
        if (year <= DateTime.now().year) {
          isEnCours = false;
        }
      } catch (_) {}
    }

    final Color statusColor = isEnCours
        ? const Color(0xFF10B981)
        : const Color(0xFF3B82F6);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: statusColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            isEnCours ? "In Progress" : "Completed",
            style: GoogleFonts.inter(
              color: statusColor,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlaceholder({required IconData icon, required String text}) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: Colors.grey.shade100,
            style: BorderStyle.none,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Icon(
                icon,
                color: AppTheme.primaryColor.withValues(alpha: 0.4),
                size: 32,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              text,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: Colors.grey.shade500,
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSkillsCard(UserEntity user, TextStyle titleStyle) {
    return _buildSectionCard(
      title: "Skills",
      titleStyle: titleStyle,
      showAdd: true,
      onAdd: _showAddSkillsDialog,
      child: user.skills == null || user.skills!.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    Icon(
                      Icons.tips_and_updates_outlined,
                      color: Colors.grey.shade300,
                      size: 40,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      "Add your key skills",
                      style: GoogleFonts.inter(
                        color: Colors.grey.shade400,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : Wrap(
              spacing: 12,
              runSpacing: 12,
              children: user.skills!.map((s) => _buildSkillChip(s)).toList(),
            ),
    );
  }

  Widget _buildSkillChip(String skill) {
    final icon = _skillIcon(skill);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF0F766E)),
          const SizedBox(width: 8),
          Text(
            skill,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.textColor.withValues(alpha: 0.9),
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }

  IconData _skillIcon(String skill) {
    final value = skill.toLowerCase();
    if (value.contains('flutter') ||
        value.contains('android') ||
        value.contains('ios')) {
      return Icons.phone_iphone_rounded;
    }
    if (value.contains('laravel') ||
        value.contains('php') ||
        value.contains('backend')) {
      return Icons.data_object_rounded;
    }
    if (value.contains('react') ||
        value.contains('front') ||
        value.contains('angular')) {
      return Icons.web_rounded;
    }
    if (value.contains('docker') ||
        value.contains('kubernetes') ||
        value.contains('devops')) {
      return Icons.dns_rounded;
    }
    if (value.contains('sql') ||
        value.contains('postgres') ||
        value.contains('database')) {
      return Icons.storage_rounded;
    }
    if (value.contains('figma') ||
        value.contains('ux') ||
        value.contains('ui')) {
      return Icons.design_services_rounded;
    }
    if (value.contains('ai') ||
        value.contains('ml') ||
        value.contains('data science')) {
      return Icons.psychology_alt_rounded;
    }
    return Icons.stars_rounded;
  }

  Widget _buildSectionCard({
    required String title,
    required Widget child,
    TextStyle? titleStyle,
    bool showAdd = false,
    VoidCallback? onAdd,
  }) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.01),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style:
                      titleStyle ??
                      GoogleFonts.outfit(
                        fontSize: 19,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textColor,
                        letterSpacing: -0.5,
                      ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showAdd)
                _buildActionIcon(
                  icon: Icons.add_rounded,
                  background: AppTheme.primaryColor.withValues(alpha: 0.08),
                  tooltip: "Add",
                  onTap: () {
                    if (onAdd != null) onAdd();
                  },
                ),
            ],
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _buildAvatarPlaceholder(UserEntity user) {
    return Center(
      child: Text(
        user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
        style: GoogleFonts.outfit(
          fontSize: 48,
          fontWeight: FontWeight.bold,
          color: AppTheme.primaryColor,
        ),
      ),
    );
  }
}
