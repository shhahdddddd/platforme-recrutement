<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UrgentContact;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class UrgentContactController extends Controller
{
    /**
     * Display a listing of the resource for admin.
     */
    public function index()
    {
        // Only admin should access this
        $contacts = UrgentContact::with(['company.user', 'resolvedBy'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $contacts
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'problemType' => 'required|string',
            'description' => 'required|string|min:10',
        ]);

        $user = $request->user();

        Log::info('UrgentContact store attempt', [
            'user_id' => $user ? $user->id : 'null',
            'role' => $user ? $user->role : 'null'
        ]);

        if (!$user || strtoupper($user->role) !== 'COMPANY') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: Only enterprise accounts can send urgent reports'
            ], 403);
        }

        $company = $user->company;
        if (!$company) {
            return response()->json([
                'success' => false,
                'message' => 'Company profile not found'
            ], 404);
        }

        $contact = UrgentContact::create([
            'company_id' => $company->id,
            'problem_type' => $request->problemType,
            'description' => $request->description,
            'status' => 'en attente'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Message sent successfully',
            'data' => $contact
        ]);
    }

    /**
     * Update the status of the contact message.
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:en attente,solved'
        ]);

        $user = $request->user();
        $contact = UrgentContact::findOrFail($id);

        $update = ['status' => $request->status];
        if ($request->status === 'solved') {
            // Store the user ID directly since resolved_by references admins but auth uses users table
            $update['resolved_by'] = $user->id;
            $update['resolved_at'] = now();
        } else {
            $update['resolved_by'] = null;
            $update['resolved_at'] = null;
        }

        $contact->update($update);
        $contact->load(['company.user', 'resolvedBy']);

        return response()->json([
            'success' => true,
            'message' => 'Status updated successfully',
            'data' => $contact
        ]);
    }
}
