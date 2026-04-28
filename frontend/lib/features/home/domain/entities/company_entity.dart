import 'package:equatable/equatable.dart';
import 'job_offer_entity.dart';

class CompanyEntity extends Equatable {
  final int id;
  final String name;
  final String? description;
  final String? picture;
  final String? location;
  final String? country;
  final int? industryId;
  final String? industryName;
  final String? employeeCount;
  final bool? international;
  final String? companyType;
  final int? departmentsCount;
  final int? recruitersCount;
  final List<JobOfferEntity> jobOffers;

  const CompanyEntity({
    required this.id,
    required this.name,
    this.description,
    this.picture,
    this.location,
    this.country,
    this.industryId,
    this.industryName,
    this.employeeCount,
    this.international,
    this.companyType,
    this.departmentsCount,
    this.recruitersCount,
    this.jobOffers = const [],
  });

  @override
  List<Object?> get props => [
    id,
    name,
    description,
    picture,
    location,
    country,
    industryId,
    industryName,
    employeeCount,
    international,
    companyType,
    departmentsCount,
    recruitersCount,
    jobOffers,
  ];
}
