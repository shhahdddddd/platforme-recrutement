import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecases/usecase.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class SignUpUseCase implements UseCase<UserEntity, SignUpParams> {
  final AuthRepository repository;

  SignUpUseCase(this.repository);

  @override
  Future<Either<Failure, UserEntity>> call(SignUpParams params) async {
    return await repository.signUp(
      name: params.name,
      email: params.email,
      password: params.password,
      role: params.role,
      phone: params.phone,
      location: params.location,
      bio: params.bio,
      specialite: params.specialite,
      isStudent: params.isStudent,
      isEngineer: params.isEngineer,
      companyName: params.companyName,
      companyDescription: params.companyDescription,
      industry: params.industry,
      photoPath: params.photoPath,
      businessOwner: params.businessOwner,
    );
  }
}

class SignUpParams extends Equatable {
  final String name;
  final String email;
  final String password;
  final String role;
  
  // Optional profile fields
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

  const SignUpParams({
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
