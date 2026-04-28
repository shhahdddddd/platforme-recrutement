<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CompanyCandidateController extends Controller
{
    /**
     * Get all candidates/interns for the company
     */
    public function index(Request $request)
    {
        try {
            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // For now, return mock data - in production this would query the database
            // You should create a company_candidates table with fields:
            // - id, company_id, first_name, last_name, email, phone
            // - position, department, start_date, attendance (remote/onsite/hybrid)
            // - attendance_schedule (JSON), status, created_at, updated_at

            $candidates = [
                [
                    'id' => 1,
                    'first_name' => 'Ahmed',
                    'last_name' => 'Ben Ali',
                    'email' => 'ahmed@example.com',
                    'phone' => '+216 12 345 678',
                    'position' => 'Software Engineer Intern',
                    'department' => 'Engineering',
                    'start_date' => '2024-01-15',
                    'attendance' => 'hybrid',
                    'attendance_schedule' => [
                        'days' => ['Mon', 'Tue', 'Wed'],
                        'start_time' => '09:00',
                        'end_time' => '17:00'
                    ],
                    'status' => 'active'
                ],
                [
                    'id' => 2,
                    'first_name' => 'Sara',
                    'last_name' => 'Smith',
                    'email' => 'sara@example.com',
                    'phone' => '+216 98 765 432',
                    'position' => 'Marketing Intern',
                    'department' => 'Marketing',
                    'start_date' => '2024-02-01',
                    'attendance' => 'remote',
                    'attendance_schedule' => null,
                    'status' => 'active'
                ],
                [
                    'id' => 3,
                    'first_name' => 'John',
                    'last_name' => 'Doe',
                    'email' => 'john@example.com',
                    'phone' => '+216 55 123 456',
                    'position' => 'HR Intern',
                    'department' => 'Human Resources',
                    'start_date' => '2024-03-01',
                    'attendance' => 'onsite',
                    'attendance_schedule' => null,
                    'status' => 'pending'
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $candidates
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching candidates: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching candidates'
            ], 500);
        }
    }

    /**
     * Store a new candidate
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'phone' => 'nullable|string|max:20',
                'position' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'start_date' => 'nullable|date',
                'attendance' => 'nullable|in:remote,onsite,hybrid',
                'attendance_schedule' => 'nullable|array',
                'attendance_schedule.days' => 'required_with:attendance_schedule|array',
                'attendance_schedule.start_time' => 'required_with:attendance_schedule|string',
                'attendance_schedule.end_time' => 'required_with:attendance_schedule|string',
                'status' => 'required|in:active,inactive,pending'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // In production, save to database:
            // $candidate = CompanyCandidate::create([
            //     'company_id' => $company->id,
            //     ...$request->all()
            // ]);

            // For now, return mock response
            $candidate = [
                'id' => rand(100, 999),
                ...$request->all()
            ];

            return response()->json([
                'success' => true,
                'message' => 'Candidate added successfully',
                'data' => $candidate
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error creating candidate: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error creating candidate'
            ], 500);
        }
    }

    /**
     * Get a specific candidate
     */
    public function show(Request $request, int $id)
    {
        try {
            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // In production, query the database:
            // $candidate = CompanyCandidate::where('company_id', $company->id)->find($id);

            // For now, return mock data
            $candidate = [
                'id' => $id,
                'first_name' => 'Ahmed',
                'last_name' => 'Ben Ali',
                'email' => 'ahmed@example.com',
                'phone' => '+216 12 345 678',
                'position' => 'Software Engineer Intern',
                'department' => 'Engineering',
                'start_date' => '2024-01-15',
                'attendance' => 'hybrid',
                'attendance_schedule' => [
                    'days' => ['Mon', 'Tue', 'Wed'],
                    'start_time' => '09:00',
                    'end_time' => '17:00'
                ],
                'status' => 'active'
            ];

            return response()->json([
                'success' => true,
                'data' => $candidate
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching candidate: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching candidate'
            ], 500);
        }
    }

    /**
     * Update a candidate
     */
    public function update(Request $request, int $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'first_name' => 'sometimes|string|max:255',
                'last_name' => 'sometimes|string|max:255',
                'email' => 'sometimes|email|max:255',
                'phone' => 'nullable|string|max:20',
                'position' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'start_date' => 'nullable|date',
                'attendance' => 'nullable|in:remote,onsite,hybrid',
                'attendance_schedule' => 'nullable|array',
                'status' => 'sometimes|in:active,inactive,pending'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // In production:
            // $candidate = CompanyCandidate::where('company_id', $company->id)->find($id);
            // $candidate->update($request->all());

            return response()->json([
                'success' => true,
                'message' => 'Candidate updated successfully',
                'data' => [
                    'id' => $id,
                    ...$request->all()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating candidate: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error updating candidate'
            ], 500);
        }
    }

    /**
     * Delete a candidate
     */
    public function destroy(Request $request, int $id)
    {
        try {
            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // In production:
            // $candidate = CompanyCandidate::where('company_id', $company->id)->find($id);
            // $candidate->delete();

            return response()->json([
                'success' => true,
                'message' => 'Candidate deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting candidate: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error deleting candidate'
            ], 500);
        }
    }

    /**
     * Update candidate attendance
     */
    public function updateAttendance(Request $request, int $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'attendance' => 'required|in:remote,onsite,hybrid',
                'attendance_schedule' => 'nullable|array',
                'attendance_schedule.days' => 'required_with:attendance_schedule|array',
                'attendance_schedule.start_time' => 'required_with:attendance_schedule|string',
                'attendance_schedule.end_time' => 'required_with:attendance_schedule|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->attributes->get('user');
            $company = $user->company;

            if (!$company) {
                return response()->json([
                    'success' => false,
                    'message' => 'Company not found'
                ], 404);
            }

            // In production:
            // $candidate = CompanyCandidate::where('company_id', $company->id)->find($id);
            // $candidate->update([
            //     'attendance' => $request->attendance,
            //     'attendance_schedule' => $request->attendance_schedule
            // ]);

            Log::info("Updated attendance for candidate {$id}", [
                'attendance' => $request->attendance,
                'schedule' => $request->attendance_schedule
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Attendance updated successfully',
                'data' => [
                    'id' => $id,
                    'attendance' => $request->attendance,
                    'attendance_schedule' => $request->attendance_schedule
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating attendance: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error updating attendance'
            ], 500);
        }
    }
}
