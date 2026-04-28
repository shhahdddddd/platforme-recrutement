import 'package:equatable/equatable.dart';

class EducationEntity extends Equatable {
  final int id;
  final String? university;
  final String? diploma;
  final String? level;
  final String? startDate;
  final String? endDate;

  const EducationEntity({
    required this.id,
    this.university,
    this.diploma,
    this.level,
    this.startDate,
    this.endDate,
  });

  @override
  List<Object?> get props => [id, university, diploma, level, startDate, endDate];
}
