<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessCvJob;
use App\Services\CompanyRealtimeNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class CvController extends Controller
{
    public function __construct(
        private CompanyRealtimeNotificationService $companyRealtimeNotificationService
    ) {}

    /**
     * Upload and process CV file.
     * After storing the file, the ProcessCvJob is dispatched to:
     *   - Parse the CV with the AI pipeline
     *   - Score any existing pending applications for this candidate
     */
    public function upload(Request $request)
    {
        $request->validate([
            'cv' => 'required|file|mimes:pdf|max:3072', // Max 3MB, PDF only
        ]);

        $user = Auth::user();

        try {
            // Store the CV file
            $file     = $request->file('cv');
            $fileName = 'cv_' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $filePath = $file->storeAs('cvs', $fileName, 'public');

            // Update candidate CV path
            if ($user->isCandidate() && $user->candidate) {
                $user->candidate->attachCvFile($filePath);
            }

            // Dispatch background job — will parse CV and score all pending applications.
            $this->dispatchProcessCvJob(
                (int) $user->id,
                Storage::disk('public')->path($filePath)
            );

            // Generate CORS-friendly URL
            $cvUrl = url('/api/files/cvs/' . basename($filePath));

            return response()->json([
                'success' => true,
                'message' => 'CV uploaded successfully. Processing in background.',
                'data'    => [
                    'file_path' => $filePath,
                    'cv_url'    => $cvUrl,
                    'status'    => 'processing',
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'CV upload failed',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Get CV processing status.
     */
    public function status(Request $request)
    {
        $user = Auth::user();

        if (!$user->isCandidate() || !$user->candidate) {
            return response()->json([
                'success' => false,
                'message' => 'Not a candidate',
            ], 403);
        }

        $latestCvStoragePath = $user->candidate->latestCvStoragePath();

        return response()->json([
            'success' => true,
            'data'    => [
                'cv_path' => $user->candidate->cv_path,
                'parsed'  => (bool) $latestCvStoragePath,
            ]
        ]);
    }

    /**
     * Delete CV file.
     */
    public function delete(Request $request)
    {
        $user = Auth::user();

        if (!$user->isCandidate() || !$user->candidate) {
            return response()->json([
                'success' => false,
                'message' => 'Not a candidate',
            ], 403);
        }

        try {
            $cvPaths = $user->candidate->clearCvFiles();

            foreach ($cvPaths as $cvPath) {
                $storagePath = $cvPath;
                if (str_starts_with($storagePath, 'http')) {
                    $storagePath = 'cvs/' . basename($storagePath);
                }

                if ($storagePath && Storage::disk('public')->exists($storagePath)) {
                    Storage::disk('public')->delete($storagePath);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'CV deleted successfully',
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'CV deletion failed',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    private function dispatchProcessCvJob(int $userId, string $cvAbsolutePath): void
    {
        if ($this->shouldRunAiScoringInline()) {
            ProcessCvJob::dispatchSync($userId, $cvAbsolutePath);
            return;
        }

        ProcessCvJob::dispatch($userId, $cvAbsolutePath);
    }

    private function shouldRunAiScoringInline(): bool
    {
        $configured = env('AI_SCORING_INLINE');
        if ($configured !== null && $configured !== '') {
            return (bool) filter_var($configured, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }

        return app()->environment('local');
    }
}
