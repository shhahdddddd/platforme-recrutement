import 'package:equatable/equatable.dart';
import '../../../profile/domain/entities/education_entity.dart';

class UserEntity extends Equatable {
  final String id;
  final String name;
  final String email;
  final String role; // 'candidat', 'entreprise', 'client'
  final String? token;
  final String? refreshToken;
  final String? location;
  final String? bio;
  final String? phone;
  final String? specialite;
  final String? companyName;
  final String? companyDescription;
  final String? industry;
  final String? photoPath;
  final List<String>? skills;
  final String? university;
  final String? diploma;
  final String? startYear;
  final String? endYear;
  final List<EducationEntity>? educations;
  final bool? isStudent;
  final bool? isEngineer;

  const UserEntity({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.token,
    this.refreshToken,
    this.location,
    this.bio,
    this.phone,
    this.specialite,
    this.companyName,
    this.companyDescription,
    this.industry,
    this.photoPath,
    this.skills,
    this.university,
    this.diploma,
    this.startYear,
    this.endYear,
    this.educations,
    this.isStudent,
    this.isEngineer,
  });

  UserEntity copyWith({
    String? id,
    String? name,
    String? email,
    String? role,
    String? token,
    String? refreshToken,
    String? location,
    String? bio,
    String? phone,
    String? specialite,
    String? companyName,
    String? companyDescription,
    String? industry,
    String? photoPath,
    List<String>? skills,
    String? university,
    String? diploma,
    String? startYear,
    String? endYear,
    List<EducationEntity>? educations,
    bool? isStudent,
    bool? isEngineer,
  }) {
    return UserEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      role: role ?? this.role,
      token: token ?? this.token,
      refreshToken: refreshToken ?? this.refreshToken,
      location: location ?? this.location,
      bio: bio ?? this.bio,
      phone: phone ?? this.phone,
      specialite: specialite ?? this.specialite,
      companyName: companyName ?? this.companyName,
      companyDescription: companyDescription ?? this.companyDescription,
      industry: industry ?? this.industry,
      photoPath: photoPath ?? this.photoPath,
      skills: skills ?? this.skills,
      university: university ?? this.university,
      diploma: diploma ?? this.diploma,
      startYear: startYear ?? this.startYear,
      endYear: endYear ?? this.endYear,
      educations: educations ?? this.educations,
      isStudent: isStudent ?? this.isStudent,
      isEngineer: isEngineer ?? this.isEngineer,
    );
  }

  @override
  List<Object?> get props => [
    id, name, email, role, token, refreshToken,
    location, bio, phone, specialite, 
    companyName, companyDescription, industry, photoPath, skills,
    university, diploma, startYear, endYear, educations,
    isStudent, isEngineer
  ];
}
