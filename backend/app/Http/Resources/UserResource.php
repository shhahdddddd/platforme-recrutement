<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    protected $token = null;
    protected $profile = null;

    /**
     * Create a new resource instance with optional token and profile.
     */
    public function __construct($resource, $token = null, $profile = null)
    {
        parent::__construct($resource);
        $this->token = $token;
        $this->profile = $profile;
    }

    /**
     * Transform the resource into an array.
     */
    public function toArray($request): array
    {
        $role = strtoupper($this->role);

        $picturePath = null;
        if ($this->profile) {
            // For Company profiles, the profile might be Hr or Company model
            // Both have a 'picture' attribute with an accessor that returns full URL
            if (isset($this->profile->picture)) {
                $picturePath = $this->profile->picture;
            }
            // If hr profile is loaded with company, check company picture
            if (!$picturePath && isset($this->profile->company) && $this->profile->company) {
                $picturePath = $this->profile->company->picture;
            }
        }

        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $role,
            'last_login' => $this->last_login,
            'created_at' => $this->created_at,
            'profile' => $this->profile,
            'photo_path' => $picturePath,
            'token' => $this->when($this->token, $this->token),
            'token_type' => $this->when($this->token, 'Bearer'),
        ];
    }
}
