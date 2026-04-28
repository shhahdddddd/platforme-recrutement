import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_theme.dart';

class ImagePickerWidget extends StatefulWidget {
  final Function(String path) onImageSelected;
  final String? label;

  const ImagePickerWidget({
    super.key,
    required this.onImageSelected,
    this.label,
  });

  @override
  State<ImagePickerWidget> createState() => _ImagePickerWidgetState();
}

class _ImagePickerWidgetState extends State<ImagePickerWidget> {
  File? _image;
  String? _webImagePath;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage() async {
    final XFile? pickedFile = await _picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      setState(() {
        if (kIsWeb) {
          _webImagePath = pickedFile.path;
        } else {
          _image = File(pickedFile.path);
        }
      });
      widget.onImageSelected(pickedFile.path);
    }
  }

  Widget _buildImage() {
    if (kIsWeb) {
      return _webImagePath != null
          ? Image.network(_webImagePath!, fit: BoxFit.cover)
          : Container(
              color: AppTheme.primaryColor.withValues(alpha: 0.03),
              child: const Icon(
                Icons.person_outline_rounded,
                size: 45,
                color: AppTheme.primaryColor,
              ),
            );
    } else {
      return _image != null
          ? Image.file(_image!, fit: BoxFit.cover)
          : Container(
              color: AppTheme.primaryColor.withValues(alpha: 0.03),
              child: const Icon(
                Icons.person_outline_rounded,
                size: 45,
                color: AppTheme.primaryColor,
              ),
            );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: _pickImage,
          child: Stack(
            alignment: Alignment.bottomRight,
            children: [
              Container(
                height: 100,
                width: 100,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primaryColor.withValues(alpha: 0.1), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryColor.withValues(alpha: 0.1),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    )
                  ],
                ),
                child: ClipOval(
                  child: _buildImage(),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 5,
                      offset: const Offset(0, 2),
                    )
                  ],
                ),
                child: const Icon(
                  Icons.add_a_photo_outlined,
                  size: 16,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
        if (widget.label != null) ...[
          const SizedBox(height: 12),
          Text(
            widget.label!,
            style: const TextStyle(
              color: AppTheme.subtextColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}
