import 'package:equatable/equatable.dart';
import '../../domain/entities/user_entity.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

class LoginEvent extends AuthEvent {
  final String email;
  final String password;

  const LoginEvent({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class SignUpEvent extends AuthEvent {
  final String name;
  final String email;
  final String password;
  final String role;
  
  // Optional parameters matching UseCase
  final String? phone;
  final String? location;
  final String? bio;
  final String? specialite;
  final bool? isStudent;
  final bool? isEngineer;
  final String? companyName;
  final String? companyDescription;
  final String? industry;
  final String? photoPath;
  final bool? businessOwner;

  const SignUpEvent({
    required this.name,
    required this.email,
    required this.password,
    required this.role,
    this.phone,
    this.location,
    this.bio,
    this.specialite,
    this.isStudent,
    this.isEngineer,
    this.companyName,
    this.companyDescription,
    this.industry,
    this.photoPath,
    this.businessOwner,
  });

  @override
  List<Object?> get props => [
    name, email, password, role,
    phone, location, bio, specialite,
    isStudent, isEngineer,
    companyName, companyDescription, industry, photoPath, businessOwner
  ];
}

class ResetPasswordEvent extends AuthEvent {
  final String email;
  final String newPassword;

  const ResetPasswordEvent({
    required this.email,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [email, newPassword];
}
class CheckEmailEvent extends AuthEvent {
  final String email;

  const CheckEmailEvent({required this.email});

  @override
  List<Object?> get props => [email];
}

class LogoutEvent extends AuthEvent {}

class CheckAuthStatusEvent extends AuthEvent {}
class UpdatePasswordEvent extends AuthEvent {
  final String currentPassword;
  final String newPassword;

  const UpdatePasswordEvent({
    required this.currentPassword,
    required this.newPassword,
  });

  @override
  List<Object?> get props => [currentPassword, newPassword];
}

class UpdateUserEvent extends AuthEvent {
  final UserEntity user;
  const UpdateUserEvent(this.user);

  @override
  List<Object?> get props => [user];
}

class UpdateBasicInfoEvent extends AuthEvent {
  final String? name;
  final String? email;
  final String? phone;
  final String? location;
  final String? bio;

  const UpdateBasicInfoEvent({
    this.name,
    this.email,
    this.phone,
    this.location,
    this.bio,
  });

  @override
  List<Object?> get props => [name, email, phone, location, bio];
}

class SendOtpEvent extends AuthEvent {
  final String email;
  const SendOtpEvent({required this.email});

  @override
  List<Object?> get props => [email];
}

class VerifyOtpEvent extends AuthEvent {
  final String email;
  final String otp;
  const VerifyOtpEvent({required this.email, required this.otp});

  @override
  List<Object?> get props => [email, otp];
}
