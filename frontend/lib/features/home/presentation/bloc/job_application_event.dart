import 'package:equatable/equatable.dart';

abstract class JobApplicationEvent extends Equatable {
  const JobApplicationEvent();

  @override
  List<Object> get props => [];
}

class SubmitApplication extends JobApplicationEvent {
  final int jobOfferId;
  final List<int> fileBytes;
  final String fileName;

  const SubmitApplication({
    required this.jobOfferId, 
    required this.fileBytes,
    required this.fileName,
  });

  @override
  List<Object> get props => [jobOfferId, fileBytes, fileName];
}
