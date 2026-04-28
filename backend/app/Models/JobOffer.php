<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class JobOffer extends Model
{
    use HasFactory;

    protected $table = 'job_offers';
    public $timestamps = false;

    protected $fillable = [
        'company_id',
        'department_id',
        'title',
        'description',
        'date_posted',
        'location',
        'status',
        'offer_type',
        'budget',
        'contract_type_detail',
        'seniority_level',
        'quiz_questions_count',
        'relevant_clusters',
        'key_terms',
        'knowledge_base_ready',
        'preparation_error'
    ];

    protected $casts = [
        'date_posted' => 'date',
        'budget' => 'float',
        'created_at' => 'datetime',
        'deleted_at' => 'datetime',
        'relevant_clusters' => 'array',
        'key_terms' => 'array',
        'knowledge_base_ready' => 'boolean',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function requirements()
    {
        return $this->jobRequirements();
    }

    public function skills()
    {
        return $this->emptySkillsRelation();
    }

    public function jobRequirements()
    {
        return $this->emptySkillsRelation();
    }

    public function internshipSkills()
    {
        return $this->emptySkillsRelation();
    }

    public function internshipRequirements()
    {
        return $this->emptySkillsRelation();
    }

    public function savedJobs()
    {
        return $this->hasMany(SavedJob::class);
    }

    public function likes()
    {
        return $this->hasMany(JobOfferLike::class);
    }

    public function comments()
    {
        return $this->hasMany(JobOfferComment::class);
    }

    public function applications()
    {
        return $this->hasMany(Application::class, 'job_offer_id');
    }

    public function recruiters(): BelongsToMany
    {
        return $this->belongsToMany(
            Recruiter::class,
            'job_offer_recruiter_assignments',
            'job_offer_id',
            'recruiter_id'
        );
    }

    public function isSavedByUser($userId)
    {
        return $this->savedJobs()->where('user_id', $userId)->exists();
    }

    private function hasRequirementsTable(string $table): bool
    {
        static $tableExistence = [];

        if (!array_key_exists($table, $tableExistence)) {
            $tableExistence[$table] = Schema::hasTable($table);
        }

        return $tableExistence[$table];
    }

    private function emptySkillsRelation(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'job_offers', 'id', 'id')
            ->whereRaw('1 = 0');
    }
}
