import 'package:flutter/foundation.dart';
import '../../domain/entities/user_entity.dart';
import '../../../profile/domain/entities/education_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.name,
    required super.email,
    required super.role,
    super.token,
    super.refreshToken,
    super.location,
    super.bio,
    super.phone,
    super.specialite,
    super.companyName,
    super.companyDescription,
    super.industry,
    super.photoPath,
    super.skills,
    super.university,
    super.diploma,
    super.startYear,
    super.endYear,
    super.educations,
    super.isStudent,
    super.isEngineer,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    String _s(dynamic v) => v == null ? '' : v.toString();
    final profile = json['profile'] as Map<String, dynamic>?;

    // 1. Determine the name
    String? nameValue = json['name'] != null ? json['name'].toString() : null;
    if (nameValue == null || nameValue.isEmpty) {
      if (profile != null) {
        final firstName = profile['first_name'] ?? profile['firstName'];
        final lastName = profile['last_name'] ?? profile['lastName'];
        final fullName = profile['full_name'] ?? profile['fullName'] ?? profile['name'];
        if (fullName != null) {
          nameValue = fullName.toString();
        } else if (firstName != null || lastName != null) {
          nameValue = '${firstName ?? ''} ${lastName ?? ''}'.trim();
        }
      }
    }

    // 2. Normalize roles
    String normalizedRole = _s(json['role']).isEmpty ? 'candidat' : _s(json['role']);
    if (normalizedRole == 'candidate') normalizedRole = 'candidat';
    if (normalizedRole == 'CANDIDATE') normalizedRole = 'candidat';
    if (normalizedRole == 'company') normalizedRole = 'entreprise';
    if (normalizedRole == 'COMPANY') normalizedRole = 'entreprise';
    if (normalizedRole == 'recruiter') normalizedRole = 'entreprise';

    // 3. Extract Bio
    String bioValue = _s(json['bio']).isNotEmpty ? _s(json['bio']) : _s(json['description']);
    if (bioValue.isEmpty && profile != null) {
      bioValue = _s(profile['bio']).isNotEmpty ? _s(profile['bio']) : _s(profile['description']);
    }

    // 4. Extract Location
    String locationValue = _s(json['location']).isNotEmpty ? _s(json['location']) : _s(json['address']);
    if (locationValue.isEmpty && profile != null) {
      locationValue = _s(profile['location']).isNotEmpty ? _s(profile['location']) : _s(profile['address']);
    }

    // 5. Extract Specialty
    String? specialiteValue = json['specialite'] ?? json['speciality'];
    if (specialiteValue == null && profile != null) {
      specialiteValue = profile['specialite'] ?? profile['speciality'];
      if (specialiteValue == null && profile['specialty'] != null) {
        if (profile['specialty'] is Map) {
          specialiteValue = profile['specialty']['name'];
        } else {
          specialiteValue = profile['specialty'].toString();
        }
      }
    }

    // 6. Extract Skills
    List<String>? parsedSkills;
    final skillsData = json['skills'] ?? (profile != null ? profile['skills'] : null);
    if (skillsData != null) {
      if (skillsData is List) {
        parsedSkills = List<String>.from(skillsData.map((e) => e is Map ? e['name'] : e.toString()));
      } else if (skillsData is String) {
        parsedSkills = skillsData.split(',').map((e) => e.trim()).toList();
      }
    }

    // 7. Extract Photo Path
    String? rawPhotoPath = json['photo_path'] ?? profile?['photo_path'] ?? profile?['photoPath'] ?? profile?['picture'] ?? json['picture'];
    String? normalizedPhotoPath = rawPhotoPath;
    if (normalizedPhotoPath != null && normalizedPhotoPath.isEmpty) {
      normalizedPhotoPath = null;
    }
    if (!kIsWeb && normalizedPhotoPath != null) {
      if (normalizedPhotoPath.contains('localhost')) {
         normalizedPhotoPath = normalizedPhotoPath.replaceAll('localhost', '10.0.2.2');
      } else if (normalizedPhotoPath.contains('127.0.0.1')) {
         normalizedPhotoPath = normalizedPhotoPath.replaceAll('127.0.0.1', '10.0.2.2');
      }
    }

    // 8. Extract Educations
    List<EducationEntity>? parsedEducations;
    final educationsData = profile?['educations'];
    if (educationsData != null && educationsData is List) {
      parsedEducations = educationsData.map((e) {
        return EducationEntity(
          id: e['id'] ?? 0,
          university: e['university']?.toString(),
          diploma: e['diploma']?.toString(),
          level: e['level']?.toString(),
          startDate: _s(e['start_date']).isNotEmpty ? _s(e['start_date']).substring(0, 4) : null,
          endDate: _s(e['end_date']).isNotEmpty ? _s(e['end_date']).substring(0, 4) : null,
        );
      }).toList();
    }

    return UserModel(
      id: json['id']?.toString() ?? json['user_id']?.toString() ?? '123',
      name: nameValue != null && nameValue.isNotEmpty ? nameValue : 'No name',
      email: _s(json['email']),
      role: normalizedRole,
      token: _s(json['access_token']).isNotEmpty ? _s(json['access_token']) : (_s(json['token']).isNotEmpty ? _s(json['token']) : null),
      refreshToken: _s(json['refresh_token']).isNotEmpty ? _s(json['refresh_token']) : null,
      location: locationValue.isNotEmpty ? locationValue : 'Not specified',
      bio: bioValue.isNotEmpty ? bioValue : 'No biography',
      phone: (_s(json['phone']).isNotEmpty ? _s(json['phone']) : (_s(profile?['phone']).isNotEmpty ? _s(profile?['phone']) : (_s(profile?['phone_number']).isNotEmpty ? _s(profile?['phone_number']) : null))),
      specialite: specialiteValue,
      companyName: _s(json['company_name']).isNotEmpty ? _s(json['company_name']) : (_s(profile?['company_name']).isNotEmpty ? _s(profile?['company_name']) : (_s(profile?['name']).isNotEmpty ? _s(profile?['name']) : null)),
      companyDescription: _s(json['company_description']).isNotEmpty ? _s(json['company_description']) : (_s(profile?['company_description']).isNotEmpty ? _s(profile?['company_description']) : (_s(profile?['description']).isNotEmpty ? _s(profile?['description']) : null)),
      industry: _s(json['industry']).isNotEmpty ? _s(json['industry']) : (_s(profile?['industry']).isNotEmpty ? _s(profile?['industry']) : null),
      photoPath: normalizedPhotoPath,
      skills: parsedSkills,
      university: _s(profile?['university']).isNotEmpty ? _s(profile?['university']) : (_s(json['university']).isNotEmpty ? _s(json['university']) : null),
      diploma: _s(profile?['diploma']).isNotEmpty ? _s(profile?['diploma']) : (_s(json['diploma']).isNotEmpty ? _s(json['diploma']) : null),
      startYear: _s(profile?['start_year']).isNotEmpty ? _s(profile?['start_year']) : (_s(profile?['startYear']).isNotEmpty ? _s(profile?['startYear']) : (_s(json['start_year']).isNotEmpty ? _s(json['start_year']) : null)),
      endYear: _s(profile?['end_year']).isNotEmpty ? _s(profile?['end_year']) : (_s(profile?['endYear']).isNotEmpty ? _s(profile?['endYear']) : (_s(json['end_year']).isNotEmpty ? _s(json['end_year']) : null)),
      educations: parsedEducations,
      isStudent: (json['still_student'] ?? profile?['still_student']) as bool?,
      isEngineer: (json['is_engineer'] ?? profile?['is_engineer']) as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'token': token,
      'refresh_token': refreshToken,
      'location': location,
      'bio': bio,
      'phone': phone,
      'specialite': specialite,
      'company_name': companyName,
      'company_description': companyDescription,
      'industry': industry,
      'photo_path': photoPath,
      'skills': skills,
      'university': university,
      'diploma': diploma,
      'start_year': startYear,
      'end_year': endYear,
      'still_student': isStudent,
      'is_engineer': isEngineer,
    };
  }
}
