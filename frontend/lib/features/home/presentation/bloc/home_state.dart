import 'package:equatable/equatable.dart';
import '../../domain/entities/job_offer_entity.dart';

abstract class HomeState extends Equatable {
  const HomeState();

  @override
  List<Object?> get props => [];
}

class HomeInitial extends HomeState {}

class HomeLoading extends HomeState {}

class HomeLoaded extends HomeState {
  final List<JobOfferEntity> jobOffers;

  const HomeLoaded(this.jobOffers);

  @override
  List<Object?> get props => [jobOffers];
}

class HomeError extends HomeState {
  final String message;

  const HomeError(this.message);

  @override
  List<Object?> get props => [message];
}
