import 'package:equatable/equatable.dart';
import '../../domain/entities/user_entity.dart';

abstract class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object> get props => [];
}

class AuthCheckingStatus extends AuthState {}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class AuthAuthenticated extends AuthState {
  final UserEntity user;

  const AuthAuthenticated({required this.user});

  @override
  List<Object> get props => [user];
}

class AuthSignUpSuccess extends AuthState {}

class AuthPasswordResetSuccess extends AuthState {}

class AuthError extends AuthState {
  final String message;

  const AuthError({required this.message});

  @override
  List<Object> get props => [message];
}
class AuthEmailCheckResult extends AuthState {
  final bool exists;

  const AuthEmailCheckResult({required this.exists});

  @override
  List<Object> get props => [exists];
}

class UpdatePasswordSuccess extends AuthState {}
class UpdatePasswordError extends AuthState {
  final String message;

  const UpdatePasswordError({required this.message});

  @override
  List<Object> get props => [message];
}

class AuthOtpSent extends AuthState {}
class AuthOtpVerified extends AuthState {}
class AuthOtpError extends AuthState {
  final String message;
  const AuthOtpError({required this.message});
  @override
  List<Object> get props => [message];
}
