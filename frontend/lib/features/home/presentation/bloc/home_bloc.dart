import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_job_offers.dart';
import '../../../../core/usecases/usecase.dart';
import 'home_state.dart';
import 'home_event.dart';

class HomeBloc extends Bloc<HomeEvent, HomeState> {
  final GetJobOffers getJobOffers;

  HomeBloc({required this.getJobOffers}) : super(HomeInitial()) {
    on<FetchJobOffers>(_onFetchJobOffers);
    on<RefreshJobOffers>(_onRefreshJobOffers);
  }

  void _onFetchJobOffers(FetchJobOffers event, Emitter<HomeState> emit) async {
    emit(HomeLoading());
    final failureOrJobs = await getJobOffers(NoParams());
    failureOrJobs.fold(
      (failure) => emit(HomeError('Failed to fetch job offers')),
      (jobs) => emit(HomeLoaded(jobs)),
    );
  }

  void _onRefreshJobOffers(
    RefreshJobOffers event,
    Emitter<HomeState> emit,
  ) async {
    emit(HomeLoading());
    final failureOrJobs = await getJobOffers(NoParams());
    failureOrJobs.fold(
      (failure) => emit(HomeError('Failed to refresh job offers')),
      (jobs) => emit(HomeLoaded(jobs)),
    );
  }
}
