<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CompanyDocument extends Model
{
    use HasFactory;

    protected $table = 'company_documents';

    protected $fillable = [
        'company_id',
        'uploaded_by',
        'original_name',
        'file_path',
        'file_size',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'file_size'  => 'integer',
    ];

    public $timestamps = false; // using database default created_at

    const CREATED_AT = 'created_at';

    /**
     * Get the company that owns the document.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the user who uploaded the document.
     */
    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Get download URL attribute.
     */
    public function getDownloadUrlAttribute()
    {
        return url('/api/files/company-documents/' . basename($this->file_path));
    }
}
