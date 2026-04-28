<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminAuthController;

/* |-------------------------------------------------------------------------- | API Routes |-------------------------------------------------------------------------- | | Here is where you can register API routes for your application. These | routes are loaded by the RouteServiceProvider within a group which | is assigned the "api" middleware group. Enjoy building your API! | */

// Microservice internal routes
Route::prefix('internal')->group(function () {
    Route::post('/kb-document/finished', [\App\Http\Controllers\Api\CompanyDocumentController::class, 'notifyProcessingFinished']);
    Route::post('/quiz/review-ready', [\App\Http\Controllers\Api\QuizController::class, 'notifyReviewReady']);
    Route::post('/quiz/failed', [\App\Http\Controllers\Api\QuizController::class, 'notifyQuizFailed']);
    Route::post('/quiz/completed', [\App\Http\Controllers\Api\QuizController::class, 'notifyQuizCompleted']);
});

// Public Pricing for Companies and Startups (must be outside auth group)
Route::get('/pricing', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'pricing']);

// Public routes (no authentication required)
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/check-email', [AuthController::class, 'checkEmail']);
    Route::post('/send-otp', [AuthController::class, 'sendOtp']);
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::get('/email/verify/{id}/{hash}', [\App\Http\Controllers\Api\VerificationController::class, 'verify'])
        ->middleware(['signed:relative', 'throttle:6,1'])
        ->name('verification.verify');
    Route::post('/email/resend', [\App\Http\Controllers\Api\VerificationController::class, 'resend'])
        ->middleware('throttle:6,1')
        ->name('verification.resend');

    // Public Job Offers Feed
    Route::get('/job-offers', [\App\Http\Controllers\Api\JobOfferController::class, 'getAllJobOffers']);
});

// Admin authentication routes
Route::prefix('admin/auth')->group(function () {
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/refresh', [AdminAuthController::class, 'refresh']);
});

// Protected admin routes
Route::middleware(['keycloak', 'role:admin'])->prefix('admin')->group(function () {
    Route::post('/auth/logout', [AdminAuthController::class, 'logout']);
    Route::get('/auth/me', [AdminAuthController::class, 'me']);
    Route::post('/auth/fcm-token', [AdminAuthController::class, 'updateFcmToken']);

    // Dashboard Statistics
    Route::get('/dashboard-stats', [\App\Http\Controllers\Api\AdminDashboardController::class, 'getStats']);
    Route::get('/advanced-analytics', [\App\Http\Controllers\Api\AdminDashboardController::class, 'getAdvancedAnalytics']);

    // Company management
    Route::get('/companies', [\App\Http\Controllers\Api\CompanyController::class, 'index']);
    Route::post('/companies', [\App\Http\Controllers\Api\CompanyController::class, 'store']);
    Route::get('/companies/{id}', [\App\Http\Controllers\Api\CompanyController::class, 'showFullDetails']);
    Route::get('/subscription-payments', [\App\Http\Controllers\Api\CompanyController::class, 'subscriptionPayments']);
    Route::patch('/companies/{id}/toggle-status', [\App\Http\Controllers\Api\CompanyController::class, 'toggleStatus']);
    Route::post('/companies/{id}/reactivate', [\App\Http\Controllers\Api\CompanyController::class, 'reactivateWithSubscription']);

    // Industry management
    Route::get('/industries', [\App\Http\Controllers\Api\IndustryController::class, 'index']);
    Route::post('/industries', [\App\Http\Controllers\Api\IndustryController::class, 'store']);
    Route::put('/industries/{id}', [\App\Http\Controllers\Api\IndustryController::class, 'update']);
    Route::delete('/industries/{id}', [\App\Http\Controllers\Api\IndustryController::class, 'destroy']);

    // Urgent contacts for admin
    Route::get('/urgent-contacts', [\App\Http\Controllers\Api\UrgentContactController::class, 'index']);
    Route::patch('/urgent-contacts/{id}/status', [\App\Http\Controllers\Api\UrgentContactController::class, 'updateStatus']);

    // Fix Keycloak user
    Route::post('/fix-keycloak-user', [\App\Http\Controllers\Api\AdminDashboardController::class, 'fixKeycloakUser']);

    // Sync (create/update) Keycloak user password for an existing local user
    Route::post('/sync-keycloak-user', [\App\Http\Controllers\Api\AdminDashboardController::class, 'syncKeycloakUser']);

    // Subscription Plan Management
    Route::prefix('subscription-plans')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'store']);
        Route::get('/{id}', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'show']);
        Route::put('/{id}', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'destroy']);
        Route::patch('/{id}/toggle-status', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'toggleStatus']);
        Route::post('/reorder', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'reorder']);
    });
});

// Public route to serve profile pictures with CORS headers for Flutter Web
Route::get('/files/profiles/{filename}', function ($filename) {
    $path = storage_path('app/public/profiles/' . $filename);
    if (!file_exists($path))
        abort(404);

    return response()->file($path, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
    ]);
});

// Public route to serve company document PDFs with CORS headers
Route::get('/files/company-documents/{filename}', function ($filename) {
    $path = storage_path('app/public/company_documents/' . $filename);
    if (!file_exists($path))
        abort(404);

    return response()->file($path, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
    ]);
});

// Public route to serve company document PDFs with CORS headers
Route::get('/files/company-documents/{filename}', function ($filename) {
    $path = storage_path('app/public/company_documents/' . $filename);
    if (!file_exists($path))
        abort(404);

    return response()->file($path, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
    ]);
});

// Public route to serve CV files with CORS headers
Route::get('/files/cvs/{filename}', function ($filename) {
    $path = storage_path('app/public/cvs/' . $filename);
    if (!file_exists($path))
        abort(404);

    return response()->file($path, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
    ]);
});

// Public route to serve chat attachments with CORS headers
Route::get('/files/chat-attachments/{filename}', function ($filename) {
    $path = storage_path('app/public/chat_attachments/' . basename($filename));
    if (!file_exists($path))
        abort(404);

    return response()->file($path, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET',
        'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
    ]);
});

// Protected routes (authentication required)
Route::middleware('keycloak')->group(function () {
    // Auth routes
    Route::prefix('auth')->group(
        function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
            Route::post('/password/update', [AuthController::class, 'updatePassword']);
            Route::post('/profile/picture', [\App\Http\Controllers\Api\ProfileController::class, 'updatePicture']);
            Route::post('/profile/basic', [\App\Http\Controllers\Api\ProfileController::class, 'updateBasicInfo']);
            Route::post('/profile', [\App\Http\Controllers\Api\ProfileController::class, 'update']);
            Route::post('/deactivate', [AuthController::class, 'deactivateAccount']);
            Route::post('/fcm-token', [AuthController::class, 'updateFcmToken']);
        }
    );

    // Notifications
    Route::prefix('notifications')->group(
        function () {
            Route::get('/', [\App\Http\Controllers\Api\NotificationController::class, 'index']);
            Route::get('/diagnostics', [\App\Http\Controllers\Api\NotificationController::class, 'diagnostics']);
            Route::get('/unread-count', [\App\Http\Controllers\Api\NotificationController::class, 'unreadCount']);
            Route::post('/{id}/read', [\App\Http\Controllers\Api\NotificationController::class, 'markAsRead']);
            Route::post('/mark-all-read', [\App\Http\Controllers\Api\NotificationController::class, 'markAllAsRead']);
            Route::post('/send-test', [\App\Http\Controllers\Api\NotificationController::class, 'sendTest']);
            Route::delete('/{id}', [\App\Http\Controllers\Api\NotificationController::class, 'destroy']);
        }
    );

    // CV Management (Only for candidates)
    Route::middleware('role:candidate')->prefix('cv')->group(
        function () {
            Route::post('/upload', [\App\Http\Controllers\Api\CvController::class, 'upload']);
            Route::get('/status', [\App\Http\Controllers\Api\CvController::class, 'status']);
            Route::delete('/delete', [\App\Http\Controllers\Api\CvController::class, 'delete']);
        }
    );

    // Company Profile Management
    Route::prefix('company')->group(
        function () {
            Route::get('/profile', [\App\Http\Controllers\Api\CompanyController::class, 'show']);
            Route::get('/industries', [\App\Http\Controllers\Api\CompanyController::class, 'industries']);
            Route::post('/profile', [\App\Http\Controllers\Api\CompanyController::class, 'update']);
            Route::post('/password', [\App\Http\Controllers\Api\CompanyController::class, 'updatePassword']);
            Route::get('/dashboard-stats', [\App\Http\Controllers\Api\CompanyController::class, 'getDashboardStats']);
            Route::post('/contact', [\App\Http\Controllers\Api\UrgentContactController::class, 'store']);

            // Departments (accessible by any authenticated user in company context)
            Route::get('/departments', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'listDepartments']);
            Route::get('/skills', [\App\Http\Controllers\Api\SkillController::class, 'index']);

            // Recruiters (company-admin only)
            Route::middleware('role:company_admin')->group(
                function () {
                Route::post('/departments', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'createDepartment']);
                Route::patch('/departments/{id}', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'updateDepartment']);
                Route::delete('/departments/{id}', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'deleteDepartment']);
                Route::get('/recruiters', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'listRecruiters']);
                Route::get('/recruiters/{id}', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'showRecruiter']);
                Route::post('/recruiters', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'createRecruiter']);
                Route::patch('/recruiters/{id}/toggle-status', [\App\Http\Controllers\Api\CompanyRecruiterController::class, 'toggleRecruiterStatus']);
            }
            );

            // Job Offers
            Route::get('/job-offers', [\App\Http\Controllers\Api\JobOfferController::class, 'index']);
            Route::post('/job-offers', [\App\Http\Controllers\Api\JobOfferController::class, 'store']);
            Route::get('/job-offers/{id}', [\App\Http\Controllers\Api\JobOfferController::class, 'show']);
            Route::patch('/job-offers/{id}', [\App\Http\Controllers\Api\JobOfferController::class, 'update']);
            Route::patch('/job-offers/{id}/status', [\App\Http\Controllers\Api\JobOfferController::class, 'updateStatus']);
            Route::delete('/job-offers/{id}', [\App\Http\Controllers\Api\JobOfferController::class, 'destroy']);

            // Job Applications Management (Company/Recruiter)
            Route::get('/applicants', [\App\Http\Controllers\Api\JobApplicationController::class, 'getAllApplicants']);
            Route::get('/all-applicants', [\App\Http\Controllers\Api\JobApplicationController::class, 'getAllApplicants']);
            Route::get('/interviews', [\App\Http\Controllers\Api\JobApplicationController::class, 'getInterviews']);
            Route::get('/applicants/{id}', [\App\Http\Controllers\Api\JobApplicationController::class, 'showApplicant']);
            Route::post('/applications/{id}/schedule-interview', [\App\Http\Controllers\Api\JobApplicationController::class, 'scheduleInterview']);
            Route::post('/applications/{id}/reschedule-interview', [\App\Http\Controllers\Api\JobApplicationController::class, 'rescheduleInterview']);
            Route::post('/applications/{id}/cancel-interview', [\App\Http\Controllers\Api\JobApplicationController::class, 'cancelInterview']);
            Route::post('/applications/{id}/accept', [\App\Http\Controllers\Api\JobApplicationController::class, 'acceptApplication']);
            Route::post('/applications/{id}/reject', [\App\Http\Controllers\Api\JobApplicationController::class, 'rejectApplication']);
            Route::patch('/applications/{id}/attendance', [\App\Http\Controllers\Api\JobApplicationController::class, 'updateAttendance']);
            Route::get('/job-offers/{id}/applicants', [\App\Http\Controllers\Api\JobApplicationController::class, 'getJobApplicants']);
            Route::get('/applications/{id}/cv', [\App\Http\Controllers\Api\JobApplicationController::class, 'showCv']);
            Route::post('/applications/{id}/launch-interview', [\App\Http\Controllers\Api\JobApplicationController::class, 'launchInterview']);
            Route::post('/applications/{id}/assign-recruiter', [\App\Http\Controllers\Api\JobApplicationController::class, 'assignRecruiter']);

            // Recruiter Schedule Interview (separate endpoint for recruiters)
            Route::patch('/recruiter/interviews/{id}/schedule', [\App\Http\Controllers\Api\JobApplicationController::class, 'recruiterScheduleInterview']);

            // Recruiter Intern Chat
            Route::middleware('role:recruiter')->prefix('intern-chat')->group(function () {
                Route::get('/conversations', [\App\Http\Controllers\Api\InternChatController::class, 'conversations']);
                Route::get('/conversations/{applicationId}/messages', [\App\Http\Controllers\Api\InternChatController::class, 'messages']);
                Route::post('/conversations/{applicationId}/messages', [\App\Http\Controllers\Api\InternChatController::class, 'sendMessage']);
                Route::post('/conversations/{applicationId}/read', [\App\Http\Controllers\Api\InternChatController::class, 'markAsRead']);
                Route::get('/unread-count', [\App\Http\Controllers\Api\InternChatController::class, 'unreadCount']);
            });

            // Manual Quiz Routes (Recruiters)
            Route::get('/applications/{id}/manual-quiz', [\App\Http\Controllers\Api\ManualQuizController::class, 'show']);
            Route::post('/applications/{id}/manual-quiz', [\App\Http\Controllers\Api\ManualQuizController::class, 'store']);
            Route::get('/applications/{id}/manual-quiz/results', [\App\Http\Controllers\Api\ManualQuizController::class, 'results']);
            Route::delete('/applications/{id}/manual-quiz', [\App\Http\Controllers\Api\ManualQuizController::class, 'destroy']);

            // Assessment & Quiz Session Management
            Route::post('/applications/{id}/start-ai-quiz', [\App\Http\Controllers\Api\QuizController::class, 'startQuiz']);
            Route::get('/applications/{id}/quiz', [\App\Http\Controllers\Api\QuizController::class, 'showQuiz']);
            Route::patch('/applications/{id}/quiz/questions/{questionId}', [\App\Http\Controllers\Api\QuizController::class, 'updateQuizQuestion']);
            Route::delete('/applications/{id}/quiz/questions/{questionId}', [\App\Http\Controllers\Api\QuizController::class, 'deleteQuizQuestion']);
            Route::post('/applications/{id}/quiz/reorder', [\App\Http\Controllers\Api\QuizController::class, 'reorderQuiz']);
            Route::post('/applications/{id}/quiz/questions/{questionId}/regenerate', [\App\Http\Controllers\Api\QuizController::class, 'regenerateQuizQuestion']);
            Route::post('/applications/{id}/quiz/send', [\App\Http\Controllers\Api\QuizController::class, 'sendQuiz']);
            Route::get('/applications/{id}/quiz/report', [\App\Http\Controllers\Api\QuizController::class, 'showQuizReport']);
            Route::post('/applications/{id}/ai-rescore', [\App\Http\Controllers\Api\JobApplicationController::class, 'rescoreApplication']);
            Route::post('/applications/{id}/accept', [\App\Http\Controllers\Api\JobApplicationController::class, 'acceptApplication']);
            Route::post('/applications/{id}/reject', [\App\Http\Controllers\Api\JobApplicationController::class, 'rejectApplication']);

            // Company Documents (RH upload)
            Route::get('/documents', [\App\Http\Controllers\Api\CompanyDocumentController::class, 'index']);
            Route::post('/documents/upload', [\App\Http\Controllers\Api\CompanyDocumentController::class, 'upload']);
            Route::delete('/documents/{id}', [\App\Http\Controllers\Api\CompanyDocumentController::class, 'destroy']);

            // Subscription Management (Admin only)
            Route::get('/subscription', [\App\Http\Controllers\Api\CompanySubscriptionController::class, 'index']);
            Route::post('/subscription/renew', [\App\Http\Controllers\Api\CompanySubscriptionController::class, 'renew']);
            Route::post('/subscription/cancel', [\App\Http\Controllers\Api\CompanySubscriptionController::class, 'cancel']);

            // Candidates/Interns Management
            Route::get('/candidates', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'index']);
            Route::post('/candidates', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'store']);
            Route::get('/candidates/{id}', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'show']);
            Route::patch('/candidates/{id}', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'update']);
            Route::delete('/candidates/{id}', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'destroy']);
            Route::patch('/candidates/{id}/attendance', [\App\Http\Controllers\Api\CompanyCandidateController::class, 'updateAttendance']);
        }
    );

    // Job Applications (Candidate)
    Route::get('/job-offers/{id}/requirements', [\App\Http\Controllers\Api\JobOfferController::class, 'requirements']);
    Route::get('/job-offers/{id}/application-status', [\App\Http\Controllers\Api\JobApplicationController::class, 'applicationStatus']);
    Route::post('/job-offers/{id}/apply', [\App\Http\Controllers\Api\JobApplicationController::class, 'apply']);
    Route::get('/candidate/insights', [\App\Http\Controllers\Api\JobApplicationController::class, 'candidateInsights']);

    // Public Company Profile (for candidates)
    Route::get('/companies/{id}', [\App\Http\Controllers\Api\CompanyController::class, 'publicProfile']);

    // User Presence (Online/Offline status)
    Route::post('/presence/online', [\App\Http\Controllers\Api\UserPresenceController::class, 'markOnline']);
    Route::post('/presence/offline', [\App\Http\Controllers\Api\UserPresenceController::class, 'markOffline']);
    Route::post('/presence/heartbeat', [\App\Http\Controllers\Api\UserPresenceController::class, 'heartbeat']);
    Route::post('/presence/status', [\App\Http\Controllers\Api\UserPresenceController::class, 'getUsersStatus']);

    Route::middleware('role:candidate')->prefix('candidate/applications')->group(function () {
        Route::get('/{id}/quiz', [\App\Http\Controllers\Api\QuizController::class, 'candidateQuiz']);
        Route::post('/{id}/quiz/start', [\App\Http\Controllers\Api\QuizController::class, 'candidateStartQuiz']);
        Route::post('/{id}/quiz/questions/{questionId}/answer', [\App\Http\Controllers\Api\QuizController::class, 'submitCandidateAnswer']);
        Route::post('/{id}/quiz/submit', [\App\Http\Controllers\Api\QuizController::class, 'candidateSubmitQuiz']);
        Route::get('/{id}/quiz/report', [\App\Http\Controllers\Api\QuizController::class, 'candidateQuizReport']);
    });
    Route::middleware('role:candidate')->prefix('candidate/intern-chat')->group(function () {
        Route::get('/conversations', [\App\Http\Controllers\Api\InternChatController::class, 'candidateConversations']);
        Route::get('/conversations/{applicationId}/messages', [\App\Http\Controllers\Api\InternChatController::class, 'candidateMessages']);
        Route::post('/conversations/{applicationId}/messages', [\App\Http\Controllers\Api\InternChatController::class, 'candidateSendMessage']);
        Route::post('/conversations/{applicationId}/read', [\App\Http\Controllers\Api\InternChatController::class, 'candidateMarkAsRead']);
    });

    // Binome (Partner) Routes
    Route::middleware('role:candidate')->prefix('candidate/binome')->group(function () {
        Route::get('/invitations', [\App\Http\Controllers\Api\BinomeController::class, 'listInvitations']);
        Route::post('/invitations/{invitationId}/accept', [\App\Http\Controllers\Api\BinomeController::class, 'accept']);
        Route::post('/invitations/{invitationId}/reject', [\App\Http\Controllers\Api\BinomeController::class, 'reject']);
        Route::post('/invitations/{invitationId}/cancel', [\App\Http\Controllers\Api\BinomeController::class, 'cancel']);
        Route::get('/applications/{applicationId}/status', [\App\Http\Controllers\Api\BinomeController::class, 'status']);
        Route::get('/applications/{applicationId}/accepted-candidates', [\App\Http\Controllers\Api\BinomeController::class, 'acceptedCandidates']);
        Route::post('/applications/{applicationId}/invite', [\App\Http\Controllers\Api\BinomeController::class, 'invite']);
        Route::post('/applications/{applicationId}/remove', [\App\Http\Controllers\Api\BinomeController::class, 'removeBinome']);
    });

    // Job Offer Engagement (Likes & Comments)
    Route::prefix('job-offers')->group(
        function () {
            Route::get('/{id}/engagement', [\App\Http\Controllers\Api\JobOfferEngagementController::class, 'stats']);
            Route::post('/{id}/likes/toggle', [\App\Http\Controllers\Api\JobOfferEngagementController::class, 'toggleLike']);
            Route::get('/{id}/comments', [\App\Http\Controllers\Api\JobOfferEngagementController::class, 'listComments']);
            Route::post('/{id}/comments', [\App\Http\Controllers\Api\JobOfferEngagementController::class, 'addComment']);
        }
    );

    // Saved Jobs (Candidate)
    Route::prefix('saved-jobs')->group(
        function () {
            Route::get('/', [\App\Http\Controllers\Api\SavedJobController::class, 'index']);
            Route::post('/{jobId}/toggle', [\App\Http\Controllers\Api\SavedJobController::class, 'toggle']);
            Route::get('/{jobId}/check', [\App\Http\Controllers\Api\SavedJobController::class, 'check']);
        }
    );

    // User info
    Route::get(
        '/user',
        function (Request $request) {
            return $request->user();
        }
    );
});
