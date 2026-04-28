import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/check_email_usecase.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/signup_usecase.dart';
import '../../domain/usecases/reset_password_usecase.dart';
import '../../domain/usecases/check_auth_status_usecase.dart';
import '../../domain/usecases/update_password_usecase.dart';
import '../../domain/usecases/update_basic_info_usecase.dart';
import '../../domain/usecases/send_otp_usecase.dart';
import '../../domain/usecases/verify_otp_usecase.dart';
import 'auth_event.dart';
import 'auth_state.dart';
import '../../../../core/error/failures.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase loginUseCase;
  final SignUpUseCase signUpUseCase;
  final ResetPasswordUseCase resetPasswordUseCase;
  final CheckEmailUseCase checkEmailUseCase;
  final CheckAuthStatusUseCase checkAuthStatusUseCase;
  final UpdatePasswordUseCase updatePasswordUseCase;
  final UpdateBasicInfoUseCase updateBasicInfoUseCase;
  final SendOtpUseCase sendOtpUseCase;
  final VerifyOtpUseCase verifyOtpUseCase;

  AuthBloc({
    required this.loginUseCase,
    required this.signUpUseCase,
    required this.resetPasswordUseCase,
    required this.checkEmailUseCase,
    required this.checkAuthStatusUseCase,
    required this.updatePasswordUseCase,
    required this.updateBasicInfoUseCase,
    required this.sendOtpUseCase,
    required this.verifyOtpUseCase,
  }) : super(AuthCheckingStatus()) {
    on<LoginEvent>(_onLogin);
    on<SignUpEvent>(_onSignUp);
    on<CheckEmailEvent>(_onCheckEmail);
    on<ResetPasswordEvent>(_onResetPassword);
    on<LogoutEvent>(_onLogout);
    on<CheckAuthStatusEvent>(_onCheckAuthStatus);
    on<UpdatePasswordEvent>(_onUpdatePassword);
    on<UpdateUserEvent>(_onUpdateUser);
    on<UpdateBasicInfoEvent>(_onUpdateBasicInfo);
    on<SendOtpEvent>(_onSendOtp);
    on<VerifyOtpEvent>(_onVerifyOtp);
  }

  Future<void> _onCheckAuthStatus(CheckAuthStatusEvent event, Emitter<AuthState> emit) async {
    // Don't emit Loading here typically as it might flash on splash screen, but acceptable.
    // emit(AuthLoading()); 
    final result = await checkAuthStatusUseCase();
    await result.fold(
      (failure) async => emit(AuthInitial()), // If check fails, go to Initial (Login)
      (user) async => emit(AuthAuthenticated(user: user)),
    );
  }

  Future<void> _onLogout(LogoutEvent event, Emitter<AuthState> emit) async {
    // repository.logout() should be called here ideally but for now just clear state
    // We should probably add LogoutUseCase later
    emit(AuthInitial());
  }

  Future<void> _onCheckEmail(CheckEmailEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await checkEmailUseCase(event.email);
    result.fold(
      (failure) => emit(AuthError(message: _mapFailureToMessage(failure))),
      (exists) => emit(AuthEmailCheckResult(exists: exists)),
    );
  }

  Future<void> _onLogin(LoginEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await loginUseCase(LoginParams(
      email: event.email,
      password: event.password,
    ));
    
    await result.fold(
      (failure) async => emit(AuthError(message: _mapFailureToMessage(failure))),
      (user) async {
        // After successful login, fetch complete user profile
        try {
          final profileResult = await checkAuthStatusUseCase();
          await profileResult.fold(
            (failure) async => emit(AuthAuthenticated(user: user)), // Fallback to login user if profile fetch fails
            (completeUser) async => emit(AuthAuthenticated(user: completeUser)), // Use complete user data
          );
        } catch (e) {
          // If profile fetch fails, still authenticate with login user
          emit(AuthAuthenticated(user: user));
        }
      },
    );
  }

  Future<void> _onSignUp(SignUpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await signUpUseCase(SignUpParams(
      name: event.name,
      email: event.email,
      password: event.password,
      role: event.role,
      phone: event.phone,
      location: event.location,
      bio: event.bio,
      specialite: event.specialite,
      isStudent: event.isStudent,
      isEngineer: event.isEngineer,
      companyName: event.companyName,
      companyDescription: event.companyDescription,
      industry: event.industry,
      photoPath: event.photoPath,
      businessOwner: event.businessOwner,
    ));
    result.fold(
      (failure) => emit(AuthError(message: _mapFailureToMessage(failure))),
      (_) => emit(AuthSignUpSuccess()),
    );
  }

  Future<void> _onResetPassword(ResetPasswordEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await resetPasswordUseCase(ResetPasswordParams(
      email: event.email,
      newPassword: event.newPassword,
    ));
    result.fold(
      (failure) => emit(AuthError(message: _mapFailureToMessage(failure))),
      (_) => emit(AuthPasswordResetSuccess()),
    );
  }

  Future<void> _onUpdatePassword(UpdatePasswordEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await updatePasswordUseCase(event.currentPassword, event.newPassword);
    result.fold(
      (failure) => emit(UpdatePasswordError(message: _mapFailureToMessage(failure))),
      (_) => emit(UpdatePasswordSuccess()),
    );
  }

  Future<void> _onUpdateBasicInfo(UpdateBasicInfoEvent event, Emitter<AuthState> emit) async {
    final currentState = state;
    
    if (currentState is AuthAuthenticated) {
      emit(AuthLoading());
      
      final result = await updateBasicInfoUseCase(
        name: event.name,
        email: event.email,
        phone: event.phone,
        location: event.location,
        bio: event.bio,
      );

      await result.fold(
        (failure) async => emit(AuthError(message: _mapFailureToMessage(failure))),
        (_) async {
          // Re-fetch user profile to get the most up-to-date data
          final checkState = await checkAuthStatusUseCase();
          checkState.fold(
            (failure) => emit(AuthAuthenticated(user: currentState.user)),
            (updatedUser) => emit(AuthAuthenticated(user: updatedUser)),
          );
        },
      );
    }
  }

  void _onUpdateUser(UpdateUserEvent event, Emitter<AuthState> emit) {
    emit(AuthAuthenticated(user: event.user));
  }

  Future<void> _onSendOtp(SendOtpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await sendOtpUseCase(event.email);
    result.fold(
      (failure) => emit(AuthOtpError(message: _mapFailureToMessage(failure))),
      (_) => emit(AuthOtpSent()),
    );
  }

  Future<void> _onVerifyOtp(VerifyOtpEvent event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    final result = await verifyOtpUseCase(event.email, event.otp);
    result.fold(
      (failure) => emit(AuthOtpError(message: _mapFailureToMessage(failure))),
      (_) => emit(AuthOtpVerified()),
    );
  }

  String _mapFailureToMessage(Failure failure) {
    return failure.message;
  }
}
