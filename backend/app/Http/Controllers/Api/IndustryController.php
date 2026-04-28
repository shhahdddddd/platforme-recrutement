<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Industry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class IndustryController extends Controller
{
    /**
     * List industries for admin management.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $industries = Industry::query()
            ->withCount('companies')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $industries,
        ]);
    }

    /**
     * Create an industry.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:industries,name',
            'description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = $validator->validated();
        $industry = Industry::create([
            'name' => trim($payload['name']),
            'description' => isset($payload['description']) ? trim((string) $payload['description']) : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Industry created successfully.',
            'data' => $industry->fresh()->loadCount('companies'),
        ], 201);
    }

    /**
     * Update an industry.
     */
    public function update(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $industry = Industry::find($id);
        if (!$industry) {
            return response()->json([
                'success' => false,
                'message' => 'Industry not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:industries,name,' . $id,
            'description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = $validator->validated();
        $industry->update([
            'name' => trim($payload['name']),
            'description' => isset($payload['description']) ? trim((string) $payload['description']) : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Industry updated successfully.',
            'data' => $industry->fresh()->loadCount('companies'),
        ]);
    }

    /**
     * Delete an industry if not in use.
     */
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Admin access required.',
            ], 403);
        }

        $industry = Industry::find($id);
        if (!$industry) {
            return response()->json([
                'success' => false,
                'message' => 'Industry not found.',
            ], 404);
        }

        $companiesCount = $industry->companies()->count();
        if ($companiesCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete industry because it is assigned to one or more companies.',
                'companies_count' => $companiesCount,
            ], 409);
        }

        $industry->delete();

        return response()->json([
            'success' => true,
            'message' => 'Industry deleted successfully.',
        ]);
    }
}
