<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class CompanyDocumentController extends Controller
{
    /**
     * List documents for the authenticated user's company.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $company = $user->company;

        if (!$company) {
            return response()->json([
                'success' => false,
                'message' => 'No company profile found.',
            ], 404);
        }

        $documents = CompanyDocument::where('company_id', $company->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($doc) {
                return [
                    'id'            => $doc->id,
                    'original_name' => $doc->original_name,
                    'file_size'     => $doc->file_size,
                    'download_url'  => $doc->download_url,
                    'created_at'    => $doc->created_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'success' => true,
            'data'    => $documents,
        ]);
    }

    /**
     * Upload one or several PDFs.
     */
    public function upload(Request $request)
    {
        $request->validate([
            'documents'   => 'required|array|min:1',
            'documents.*' => 'required|file|mimes:pdf|max:10240', // max 10MB per file
        ]);

        $user = Auth::user();
        $company = $user->company;

        if (!$company) {
            return response()->json([
                'success' => false,
                'message' => 'No company profile found.',
            ], 404);
        }

        $results = [];

        foreach ($request->file('documents') as $file) {
            $originalName = $file->getClientOriginalName();
            $fileName     = 'company_doc_' . $company->id . '_' . time() . '_' . uniqid() . '.pdf';
            $filePath     = $file->storeAs('company_documents', $fileName, 'public');

            $doc = CompanyDocument::create([
                'company_id'    => $company->id,
                'uploaded_by'   => $user->id,
                'original_name' => $originalName,
                'file_path'     => $filePath,
                'file_size'     => $file->getSize(),
            ]);

            $results[] = [
                'id'            => $doc->id,
                'original_name' => $doc->original_name,
                'file_size'     => $doc->file_size,
                'download_url'  => $doc->download_url,
                'created_at'    => $doc->created_at?->toIso8601String(),
            ];
        }

        return response()->json([
            'success' => true,
            'message' => count($results) . ' document(s) uploaded successfully.',
            'data'    => $results,
        ], 201);
    }

    public function notifyProcessingFinished(Request $request)
    {
        $companyId = $request->input('company_id');
        $filename = $request->input('filename');
        $chunkCount = $request->input('chunk_count', 0);
        $status = $request->input('status');

        if ($status === 'ready') {
            $notifService = app(\App\Services\CompanyRealtimeNotificationService::class);
            $notifService->notifyKBDocumentProcessed($companyId, $filename, $chunkCount);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Delete a document.
     */
    public function destroy(Request $request, int $id)
    {
        $user = Auth::user();
        $company = $user->company;

        if (!$company) {
            return response()->json([
                'success' => false,
                'message' => 'No company found.',
            ], 404);
        }

        $doc = CompanyDocument::where('id', $id)
            ->where('company_id', $company->id)
            ->first();

        if (!$doc) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found.',
            ], 404);
        }

        if ($doc->file_path && Storage::disk('public')->exists($doc->file_path)) {
            Storage::disk('public')->delete($doc->file_path);
        }

        $doc->delete();

        return response()->json([
            'success' => true,
            'message' => 'Document deleted.',
        ]);
    }
}
