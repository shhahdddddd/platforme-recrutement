<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class BaseApiRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Handle a failed validation attempt.
     */
    protected function failedValidation(Validator $validator)
    {
        $errors = $validator->errors()->toArray();
        \Illuminate\Support\Facades\Log::error('Validation Errors:', $errors);

        $firstMessage = 'Validation failed';
        foreach ($errors as $field => $messages) {
            if (!empty($messages)) {
                $firstMessage = $messages[0];
                break;
            }
        }

        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => $firstMessage,
            'errors' => $errors
        ], 422));
    }
}
