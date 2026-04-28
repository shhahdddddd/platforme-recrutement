<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class Candidate extends Model
{
    use HasFactory;

    protected $table = 'candidates';

    protected $fillable = [
        'user_id',
        'picture',
        'first_name',
        'last_name',
        'phone',
        'university',
        'location',
        'specialty_id',
        'still_student',
        'cycle_eng',
        'skills',
        'bio',
        'initial_profile_score',
    ];

    protected $casts = [
        'still_student' => 'boolean',
        'cycle_eng' => 'boolean',
        'initial_profile_score' => 'float',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'skills' => 'array',
    ];

    public $timestamps = false; // We manage single columns manually or via database defaults

    /**
     * Get the user that owns the candidate profile.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the specialty of the candidate.
     */
    public function specialty()
    {
        return $this->belongsTo(Specialty::class);
    }

    /**
     * Get the skills of the candidate.
     */
    public function skills()
    {
        return $this->belongsToMany(Skill::class, 'candidate_skills')
            ->withPivot(['level', 'cv_score', 'test_score', 'final_score', 'updated_at']);
    }

    /**
     * Get applications made by the candidate.
     */
    public function applications()
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get binome invitations sent by this candidate.
     */
    public function sentBinomeInvitations()
    {
        return $this->hasMany(BinomeInvitation::class, 'inviter_candidate_id');
    }

    /**
     * Get binome invitations received by this candidate.
     */
    public function receivedBinomeInvitations()
    {
        return $this->hasMany(BinomeInvitation::class, 'invited_candidate_id');
    }

    /**
     * Get conversations where this candidate is the binome.
     */
    public function binomeConversations()
    {
        return $this->hasMany(InternChatConversation::class, 'binome_candidate_id');
    }

    /**
     * Get the education records for the candidate.
     */
    public function educations()
    {
        return $this->hasMany(CandidateEducation::class);
    }

    /**
     * Ensure the picture URL uses the current APP_URL and protocol.
     */
    public function getPictureAttribute($value)
    {
        if (!$value)
            return null;
        if (str_starts_with($value, 'http')) {
            $filename = basename($value);
            return url('/api/files/profiles/' . $filename);
        }
        return url('/api/files/profiles/' . basename($value));
    }

    /**
     * Ensure the CV path URL uses the current APP_URL and protocol.
     */
    public function getCvPathAttribute($value)
    {
        $path = $this->latestCvStoragePath();

        if (!$path && is_string($value) && $value !== '') {
            $path = $value;
        }

        if (!$path)
            return null;

        if (str_starts_with($path, 'http')) {
            $filename = basename($path);
            return url('/api/files/cvs/' . $filename);
        }

        return url('/api/files/cvs/' . basename($path));
    }

    /**
     * Returns the latest raw storage path from cv_files.
     */
    public function latestCvStoragePath(): ?string
    {
        if (!$this->id || !Schema::hasTable('cv_files')) {
            return null;
        }

        $path = DB::table('cv_files')
            ->where('candidate_id', $this->id)
            ->orderByDesc('uploaded_at')
            ->orderByDesc('id')
            ->value('file_path');

        return is_string($path) && $path !== '' ? $path : null;
    }

    /**
     * Saves a CV file reference in cv_files.
     */
    public function attachCvFile(string $storagePath): void
    {
        if (!$this->id || !Schema::hasTable('cv_files')) {
            return;
        }

        DB::table('cv_files')->insert([
            'candidate_id' => $this->id,
            'file_path' => $storagePath,
            'parsed' => false,
            'uploaded_at' => now(),
        ]);
    }

    /**
     * Removes all CV file references and returns removed storage paths.
     * Physical files still referenced by applications are NOT deleted.
     *
     * @return array<int, string>  Paths that are safe to delete from disk.
     */
    public function clearCvFiles(): array
    {
        if (!$this->id || !Schema::hasTable('cv_files')) {
            return [];
        }

        $paths = DB::table('cv_files')
            ->where('candidate_id', $this->id)
            ->pluck('file_path')
            ->filter(fn($path) => is_string($path) && $path !== '')
            ->values()
            ->all();

        // Collect filenames still referenced by applications (so we don't delete them)
        $appReferencedFiles = Application::where('candidate_id', $this->id)
            ->whereNotNull('cv_path')
            ->pluck('cv_path')
            ->map(fn($p) => basename($p))
            ->all();

        // Only return paths whose files are NOT referenced by an application
        $safePaths = collect($paths)->filter(function ($path) use ($appReferencedFiles) {
            return !in_array(basename($path), $appReferencedFiles);
        })->values()->all();

        DB::table('cv_files')->where('candidate_id', $this->id)->delete();

        return $safePaths;
    }
}
