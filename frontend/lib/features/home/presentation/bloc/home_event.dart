import 'package:equatable/equatable.dart';

abstract class HomeEvent extends Equatable {
  const HomeEvent();

  @override
  List<Object?> get props => [];
}

class FetchJobOffers extends HomeEvent {
  const FetchJobOffers();
}

class RefreshJobOffers extends HomeEvent {
  const RefreshJobOffers();
}
