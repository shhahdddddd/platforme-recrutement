import 'package:equatable/equatable.dart';
import '../../domain/entities/job_offer_entity.dart';

abstract class SavedJobsState extends Equatable {
  const SavedJobsState();

  @override
  List<Object?> get props => [];
}

class SavedJobsInitial extends SavedJobsState {}

class SavedJobsLoaded extends SavedJobsState {
  final List<JobOfferEntity> savedJobs;
  const SavedJobsLoaded(this.savedJobs);

  @override
  List<Object?> get props => [savedJobs];
}
