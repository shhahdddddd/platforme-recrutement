<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rules\Password;

class RegisterRequest extends BaseApiRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge([
                'email' => strtolower(trim((string) $this->input('email'))),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::min(8)],
            'role' => 'required|in:candidate,company',

            // Common optional
            'phone' => [
                'nullable',
                'string',
                'regex:/^[2-9]\d{7}$/',
                'max:20'
            ],
            'location' => 'nullable|string|max:255',

            // Candidate specific
            'first_name' => 'required_if:role,candidate|string|max:100',
            'last_name' => 'nullable|string|max:100',
            'bio' => 'nullable|string',
            'specialite' => 'nullable|string',
            'still_student' => 'nullable|boolean',
            'is_engineer' => 'nullable|boolean',

            // Company specific
            'company_name' => 'required_if:role,company|string|max:255',
            'description' => 'nullable|string',
            'industry' => 'nullable|string',
        ];
    }
}
