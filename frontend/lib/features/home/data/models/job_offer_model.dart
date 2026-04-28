import 'package:equatable/equatable.dart';
import '../../domain/entities/job_offer_entity.dart';

class JobOfferModel extends Equatable {
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

  const JobOfferModel({
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

  factory JobOfferModel.fromJson(Map<String, dynamic> json) {
    bool? toNullableBool(dynamic value) {
      if (value is bool) return value;
      if (value is num) return value != 0;
      if (value is String) {
        final v = value.trim().toLowerCase();
        if (v == 'true' || v == '1' || v == 'yes') return true;
        if (v == 'false' || v == '0' || v == 'no') return false;
      }
      return null;
    }

    List<JobRequirementEntity> parseRequirements(Map<String, dynamic> data) {
      final type = (data['offer_type']?.toString().toLowerCase() ?? '').trim();
      final isInternship = type == 'internship';

      final List<dynamic> candidateSources = isInternship
          ? [
              data['internship_requirements'],
              data['internshipRequirements'],
            ]
          : [
              data['job_requirements'],
              data['jobRequirements'],
            ];

      dynamic sourceRaw;
      for (final source in candidateSources) {
        if (source is List && source.isNotEmpty) {
          sourceRaw = source;
          break;
        }
      }

      if (sourceRaw is! List || sourceRaw.isEmpty) return const [];

      final List<JobRequirementEntity> results = [];
      for (final item in sourceRaw) {
        if (item is! Map) continue;

        final Map values = (item['pivot'] is Map ? item['pivot'] : item);
        final dynamic durationRaw = values['duration_months'] ??
            item['duration_months'] ??
            values['month_durations'] ??
            item['month_durations'];
        final bool? cycleEng = toNullableBool(
          values['cycle_eng'] ?? item['cycle_eng'],
        );
        final rawDegrees = values['required_degrees'] ?? item['required_degrees'];
        final List<String> degrees = [];
        if (rawDegrees is List) {
          degrees.addAll(rawDegrees.map((e) => e.toString()));
        } else if (rawDegrees is String && rawDegrees.isNotEmpty) {
          // If it's a JSON string, it will be handled by the backend typically, but just in case
          if (rawDegrees.startsWith('[') && rawDegrees.endsWith(']')) {
            // Very basic parse if needed, but usually it's already a list if JSON cast works
          }
        }

        results.add(JobRequirementEntity(
          skillName: 'Requirement',
          minimumLevel: '',
          cycleEng: cycleEng,
          durationMonths: durationRaw != null
              ? int.tryParse(durationRaw.toString())
              : null,
          startDate: null,
          requiredDegrees: degrees,
        ));
      }
      return results;
    }

    bool? parseCycleEng(
      Map<String, dynamic> data,
      List<JobRequirementEntity> reqs,
    ) {
      for (final req in reqs) {
        if (req.cycleEng != null) return req.cycleEng;
      }
      return toNullableBool(data['cycle_eng']);
    }

    final parsedRequirements = parseRequirements(json);
    
    final Set<String> skillsSet = parsedRequirements
        .map((r) => r.skillName)
        .where((name) => name.isNotEmpty && name != 'Requirement')
        .toSet();

    final List<dynamic> skillSources = [
      if (json['skills'] is List) ...(json['skills'] as List),
      if (json['job_requirements'] is List) ...(json['job_requirements'] as List),
      if (json['jobRequirements'] is List) ...(json['jobRequirements'] as List),
      if (json['internship_requirements'] is List)
        ...(json['internship_requirements'] as List),
      if (json['internshipRequirements'] is List)
        ...(json['internshipRequirements'] as List),
      if (json['internship_skills'] is List)
        ...(json['internship_skills'] as List),
      if (json['internshipSkills'] is List) ...(json['internshipSkills'] as List),
    ];

    for (final item in skillSources) {
      if (item is! Map) continue;
      final String? direct = item['name']?.toString();
      final String? nested = (item['skill'] is Map)
          ? item['skill']['name']?.toString()
          : null;
      final candidate = (direct ?? nested)?.trim();
      if (candidate != null && candidate.isNotEmpty) {
        skillsSet.add(candidate);
      }
    }

    final skillsList = skillsSet.toList();

    return JobOfferModel(
      id: json['id'] ?? 0,
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      location: json['location'] ?? '',
      offerType: json['offer_type'] ?? '',
      contractType: (json['offer_type'] == 'internship') ? '' : (json['contract_type_detail'] ?? ''),
      budget: json['budget'] != null
          ? double.parse(json['budget'].toString())
          : 0.0,
      status: json['status'] ?? 'open',
      datePosted: json['date_posted'] ?? '',
      companyId: json['company_id'] ?? 0,
      companyName: json['company'] != null
          ? (json['company']['name'] ?? 'Unknown Company')
          : 'Unknown Company',
      companyLogo: json['company'] != null
          ? (json['company']['picture'] ?? '')
          : '',
      skills: skillsList,
      requirements: parsedRequirements,
      cycleEngRequired: parseCycleEng(json, parsedRequirements),
      department: json['department'] != null
          ? (json['department']['name'] ?? 'General')
          : 'General',
      likesCount: json['likes_count'] ?? 0,
      commentsCount: json['comments_count'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'location': location,
      'offer_type': offerType,
      'contract_type_detail': contractType,
      'budget': budget,
      'status': status,
      'date_posted': datePosted,
      'company_id': companyId,
      'company': {'name': companyName, 'picture': companyLogo},
      'skills': skills.map((s) => {'name': s}).toList(),
      'requirements': requirements
          .map(
            (r) => {
              'name': r.skillName,
              'minimum_level': r.minimumLevel,
              'cycle_eng': r.cycleEng,
              'duration_months': r.durationMonths,
              'start_date': r.startDate,
            },
          )
          .toList(),
      'cycle_eng': cycleEngRequired,
      'department': {'name': department},
      'likes_count': likesCount,
      'comments_count': commentsCount,
    };
  }

  static JobOfferModel fromEntity(JobOfferEntity entity) {
    return JobOfferModel(
      id: entity.id,
      title: entity.title,
      description: entity.description,
      location: entity.location,
      offerType: entity.offerType,
      contractType: entity.contractType,
      budget: entity.budget,
      status: entity.status,
      datePosted: entity.datePosted,
      companyId: entity.companyId,
      companyName: entity.companyName,
      companyLogo: entity.companyLogo,
      skills: entity.skills,
      requirements: entity.requirements,
      cycleEngRequired: entity.cycleEngRequired,
      department: entity.department,
      likesCount: entity.likesCount,
      commentsCount: entity.commentsCount,
    );
  }

  JobOfferEntity toEntity() {
    return JobOfferEntity(
      id: id,
      title: title,
      description: description,
      location: location,
      offerType: offerType,
      contractType: contractType,
      budget: budget,
      status: status,
      datePosted: datePosted,
      companyId: companyId,
      companyName: companyName,
      companyLogo: companyLogo,
      skills: skills,
      requirements: requirements,
      cycleEngRequired: cycleEngRequired,
      department: department,
      likesCount: likesCount,
      commentsCount: commentsCount,
    );
  }

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
