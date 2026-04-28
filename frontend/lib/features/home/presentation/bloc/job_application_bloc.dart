import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/apply_to_job.dart';
import 'job_application_event.dart';
import 'job_application_state.dart';

class JobApplicationBloc
    extends Bloc<JobApplicationEvent, JobApplicationState> {
  final ApplyToJobUseCase applyToJob;

  JobApplicationBloc({required this.applyToJob})
    : super(JobApplicationInitial()) {
    on<SubmitApplication>((event, emit) async {
      emit(JobApplicationLoading());
      final result = await applyToJob(
        jobOfferId: event.jobOfferId,
        fileBytes: event.fileBytes,
        fileName: event.fileName,
      );

      result.fold(
        (failure) => emit(JobApplicationFailure(failure.message)),
        (success) => emit(JobApplicationSuccess()),
      );
    });
  }
}
