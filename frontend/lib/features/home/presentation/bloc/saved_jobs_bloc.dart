import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'saved_jobs_event.dart';
import 'saved_jobs_state.dart';
import '../../domain/entities/job_offer_entity.dart';
import '../../data/models/job_offer_model.dart';
import '../../../../core/constants/app_constants.dart';

class SavedJobsBloc extends Bloc<SavedJobsEvent, SavedJobsState> {
  final FlutterSecureStorage secureStorage;
  final Dio dio;
  String? _currentUserId;

  String _getStorageKey(String userId) => 'SAVED_JOBS_$userId';

  Future<String?> _getAuthToken() async {
    // Primary key used by AuthLocalDataSource
    final token = await secureStorage.read(key: 'CACHED_AUTH_TOKEN');
    if (token != null && token.isNotEmpty) return token;

    // Backward-compat fallback for any legacy key usage
    final legacyToken = await secureStorage.read(key: 'auth_token');
    if (legacyToken != null && legacyToken.isNotEmpty) return legacyToken;

    return null;
  }

  SavedJobsBloc({required this.secureStorage, required this.dio})
    : super(const SavedJobsLoaded([])) {
    on<ToggleSaveJob>(_onToggleSaveJob);
    on<LoadSavedJobs>(_onLoadSavedJobs);
    on<ClearSavedJobs>(_onClearSavedJobs);
  }

  Future<void> _onLoadSavedJobs(
    LoadSavedJobs event,
    Emitter<SavedJobsState> emit,
  ) async {
    final sameUser = _currentUserId == event.userId;
    _currentUserId = event.userId;

    // First, load local favorites to preserve them
    List<JobOfferEntity> localFavorites = [];
    try {
      final jsonString = await secureStorage.read(
        key: _getStorageKey(event.userId),
      );
      if (jsonString != null) {
        final List<dynamic> jsonList = json.decode(jsonString);
        localFavorites = jsonList
            .map<JobOfferEntity>((e) => JobOfferModel.fromJson(e).toEntity())
            .toList();
      }
    } catch (e) {
      print('Error reading local favorites: $e');
    }

    // If we have local favorites and it's the same user, emit them immediately
    // so the UI doesn't show empty while waiting for backend
    if (sameUser && localFavorites.isNotEmpty) {
      emit(SavedJobsLoaded(localFavorites));
    }

    try {
      // Try to load from backend
      final token = await _getAuthToken();
      if (token != null) {
        try {
          final response = await dio.get(
            '${AppConstants.apiBaseUrl}/saved-jobs',
            options: Options(
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
            ),
          );

          if (response.statusCode == 200 && response.data['success'] == true) {
            final List<dynamic> jobsData = response.data['data'] ?? [];
            final List<JobOfferEntity> jobs = jobsData
                .map<JobOfferEntity>(
                  (jobData) => JobOfferModel.fromJson(jobData).toEntity(),
                )
                .toList();

            // Only emit backend data if it has items, otherwise keep local
            if (jobs.isNotEmpty) {
              emit(SavedJobsLoaded(jobs));
              // Update local storage with backend data
              try {
                final jsonList = jobs
                    .map((e) => JobOfferModel.fromEntity(e).toJson())
                    .toList();
                await secureStorage.write(
                  key: _getStorageKey(event.userId),
                  value: json.encode(jsonList),
                );
              } catch (_) {}
            } else if (localFavorites.isNotEmpty) {
              // Backend returned empty but we have local favorites
              // Keep local favorites
              emit(SavedJobsLoaded(localFavorites));
            } else {
              emit(const SavedJobsLoaded([]));
            }
            return;
          }
        } catch (e) {
          // If backend fails, keep local favorites if available
          print('Backend load failed, keeping local favorites: $e');
          if (localFavorites.isNotEmpty) {
            emit(SavedJobsLoaded(localFavorites));
            return;
          }
        }
      }

      // Fallback to local storage if no backend response
      if (localFavorites.isNotEmpty) {
        emit(SavedJobsLoaded(localFavorites));
      } else {
        emit(const SavedJobsLoaded([]));
      }
    } catch (e) {
      // On any error, try to keep local favorites
      if (localFavorites.isNotEmpty) {
        emit(SavedJobsLoaded(localFavorites));
      } else {
        emit(const SavedJobsLoaded([]));
      }
    }
  }

  void _onClearSavedJobs(ClearSavedJobs event, Emitter<SavedJobsState> emit) {
    _currentUserId = null;
    emit(const SavedJobsLoaded([]));
  }

  Future<void> _onToggleSaveJob(
    ToggleSaveJob event,
    Emitter<SavedJobsState> emit,
  ) async {
    final currentState = state;
    if (currentState is SavedJobsLoaded && _currentUserId != null) {
      final List<JobOfferEntity> currentSavedJobs = List.from(
        currentState.savedJobs,
      );
      final isAlreadySaved = currentSavedJobs.any(
        (job) => job.id == event.job.id,
      );

      // Try to sync with backend first
      final token = await _getAuthToken();
      if (token != null) {
        try {
          final response = await dio.post(
            '${AppConstants.apiBaseUrl}/saved-jobs/${event.job.id}/toggle',
            options: Options(
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
            ),
          );

          if (response.statusCode == 200 && response.data['success'] == true) {
            final bool isSaved = response.data['data']['is_saved'];

            if (isSaved && !isAlreadySaved) {
              currentSavedJobs.add(event.job);
            } else if (!isSaved && isAlreadySaved) {
              currentSavedJobs.removeWhere((job) => job.id == event.job.id);
            }

            emit(SavedJobsLoaded(currentSavedJobs));
            return;
          }
        } catch (e) {
          print('Backend sync failed, using local storage: $e');
        }
      }

      // Fallback to local storage
      if (isAlreadySaved) {
        currentSavedJobs.removeWhere((job) => job.id == event.job.id);
      } else {
        currentSavedJobs.add(event.job);
      }

      // Save locally for offline support
      try {
        final jsonList = currentSavedJobs
            .map((e) => JobOfferModel.fromEntity(e).toJson())
            .toList();
        await secureStorage.write(
          key: _getStorageKey(_currentUserId!),
          value: json.encode(jsonList),
        );
      } catch (_) {}

      emit(SavedJobsLoaded(currentSavedJobs));
    }
  }
}
