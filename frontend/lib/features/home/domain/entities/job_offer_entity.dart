import 'package:equatable/equatable.dart';

class JobRequirementEntity extends Equatable {
  final String skillName;
  final String minimumLevel;
  final bool? cycleEng;
  final int? durationMonths;
  final String? startDate;
  final List<String> requiredDegrees;

  const JobRequirementEntity({
    required this.skillName,
    required this.minimumLevel,
    this.cycleEng,
    this.durationMonths,
    this.startDate,
    this.requiredDegrees = const [],
  });

  @override
  List<Object?> get props => [
    skillName,
    minimumLevel,
    cycleEng,
    durationMonths,
    startDate,
    requiredDegrees,
  ];
}

class JobOfferEntity extends Equatable {
  final int id;
  final String title;
  final String description;
  final String location;
  final String offerType;
  final String contractType;
  final double budget;
  final String status;
  final String datePosted;
  final int companyId;
  final String companyName;
  final String companyLogo;
  final List<String> skills;
  final List<JobRequirementEntity> requirements;
  final bool? cycleEngRequired;
  final String department;
  final int likesCount;
  final int commentsCount;

  const JobOfferEntity({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.offerType,
    required this.contractType,
    required this.budget,
    required this.status,
    required this.datePosted,
    this.companyId = 0,
    required this.companyName,
    required this.companyLogo,
    required this.skills,
    this.requirements = const [],
    this.cycleEngRequired,
    required this.department,
    this.likesCount = 0,
    this.commentsCount = 0,
  });

  @override
  List<Object?> get props => [
    id,
    title,
    description,
    location,
    offerType,
    contractType,
    budget,
    status,
    datePosted,
    companyId,
    companyName,
    companyLogo,
    skills,
    requirements,
    cycleEngRequired,
    department,
    likesCount,
    commentsCount,
  ];
}
