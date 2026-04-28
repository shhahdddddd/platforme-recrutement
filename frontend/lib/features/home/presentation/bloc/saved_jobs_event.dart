import 'package:equatable/equatable.dart';
import '../../domain/entities/job_offer_entity.dart';

abstract class SavedJobsEvent extends Equatable {
  const SavedJobsEvent();

  @override
  List<Object?> get props => [];
}

class ToggleSaveJob extends SavedJobsEvent {
  final JobOfferEntity job;
  const ToggleSaveJob(this.job);

  @override
  List<Object?> get props => [job];
}

class LoadSavedJobs extends SavedJobsEvent {
  final String userId;
  const LoadSavedJobs(this.userId);

  @override
  List<Object?> get props => [userId];
}

class ClearSavedJobs extends SavedJobsEvent {}
