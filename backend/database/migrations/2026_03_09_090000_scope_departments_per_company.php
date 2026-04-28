<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('departments')) {
            return;
        }

        Schema::table('departments', function (Blueprint $table) {
            if (!Schema::hasColumn('departments', 'company_id')) {
                $table->integer('company_id')->nullable();
            }
        });

        $this->dropConstraintIfExists('departments_name_unique');
        $this->dropConstraintIfExists('departments_company_id_name_unique');
        $this->dropConstraintIfExists('departments_company_id_foreign');

        $this->remapLinkedDepartments();
        $this->deduplicateDepartmentsPerCompany();

        // Remove legacy global catalog rows so departments are fully company-managed.
        DB::table('departments')->whereNull('company_id')->delete();

        DB::statement('ALTER TABLE departments ALTER COLUMN company_id SET NOT NULL');
        DB::statement('ALTER TABLE departments ADD CONSTRAINT departments_company_id_foreign FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE');
        DB::statement('ALTER TABLE departments ADD CONSTRAINT departments_company_id_name_unique UNIQUE (company_id, name)');
    }

    public function down(): void
    {
        if (!Schema::hasTable('departments')) {
            return;
        }

        $this->dropConstraintIfExists('departments_company_id_name_unique');
        $this->dropConstraintIfExists('departments_company_id_foreign');

        if (Schema::hasColumn('departments', 'company_id')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->dropColumn('company_id');
            });
        }
    }

    private function remapLinkedDepartments(): void
    {
        $references = collect();

        if (Schema::hasTable('recruiters')) {
            $references = $references->merge(
                DB::table('recruiters as r')
                    ->join('departments as d', 'd.id', '=', 'r.department_id')
                    ->whereNotNull('r.company_id')
                    ->whereNotNull('r.department_id')
                    ->select([
                        'r.company_id as company_id',
                        'r.department_id as old_department_id',
                        'd.name as name',
                        'd.description as description',
                    ])
                    ->get()
            );
        }

        if (Schema::hasTable('job_offers')) {
            $references = $references->merge(
                DB::table('job_offers as j')
                    ->join('departments as d', 'd.id', '=', 'j.department_id')
                    ->whereNotNull('j.company_id')
                    ->whereNotNull('j.department_id')
                    ->select([
                        'j.company_id as company_id',
                        'j.department_id as old_department_id',
                        'd.name as name',
                        'd.description as description',
                    ])
                    ->get()
            );
        }

        $mapping = [];

        foreach ($references as $reference) {
            $companyId = (int) $reference->company_id;
            $oldDepartmentId = (int) $reference->old_department_id;
            $departmentName = $this->normalizeName((string) $reference->name);

            if ($companyId <= 0 || $oldDepartmentId <= 0 || $departmentName === '') {
                continue;
            }

            $mapKey = $companyId . ':' . $oldDepartmentId;
            if (isset($mapping[$mapKey])) {
                continue;
            }

            $existingDepartmentId = DB::table('departments')
                ->where('company_id', $companyId)
                ->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($departmentName)])
                ->value('id');

            if (!$existingDepartmentId) {
                $existingDepartmentId = DB::table('departments')->insertGetId([
                    'company_id' => $companyId,
                    'name' => $departmentName,
                    'description' => $reference->description,
                ]);
            }

            $mapping[$mapKey] = (int) $existingDepartmentId;
        }

        foreach ($mapping as $key => $newDepartmentId) {
            [$companyId, $oldDepartmentId] = array_map('intval', explode(':', $key));

            if (Schema::hasTable('recruiters')) {
                DB::table('recruiters')
                    ->where('company_id', $companyId)
                    ->where('department_id', $oldDepartmentId)
                    ->update(['department_id' => $newDepartmentId]);
            }

            if (Schema::hasTable('job_offers')) {
                DB::table('job_offers')
                    ->where('company_id', $companyId)
                    ->where('department_id', $oldDepartmentId)
                    ->update(['department_id' => $newDepartmentId]);
            }
        }
    }

    private function deduplicateDepartmentsPerCompany(): void
    {
        $duplicates = DB::table('departments')
            ->select([
                'company_id',
                DB::raw('LOWER(TRIM(name)) as normalized_name'),
                DB::raw('COUNT(*) as duplicate_count'),
            ])
            ->whereNotNull('company_id')
            ->groupBy('company_id', DB::raw('LOWER(TRIM(name))'))
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $departmentIds = DB::table('departments')
                ->where('company_id', (int) $duplicate->company_id)
                ->whereRaw('LOWER(TRIM(name)) = ?', [$duplicate->normalized_name])
                ->orderBy('id')
                ->pluck('id')
                ->map(fn($id) => (int) $id)
                ->values();

            if ($departmentIds->count() < 2) {
                continue;
            }

            $keepId = $departmentIds->first();
            $removeIds = $departmentIds->slice(1)->all();

            if (Schema::hasTable('recruiters')) {
                DB::table('recruiters')
                    ->whereIn('department_id', $removeIds)
                    ->update(['department_id' => $keepId]);
            }

            if (Schema::hasTable('job_offers')) {
                DB::table('job_offers')
                    ->whereIn('department_id', $removeIds)
                    ->update(['department_id' => $keepId]);
            }

            DB::table('departments')->whereIn('id', $removeIds)->delete();
        }
    }

    private function dropConstraintIfExists(string $constraintName): void
    {
        DB::statement(sprintf('ALTER TABLE departments DROP CONSTRAINT IF EXISTS %s', $constraintName));
    }

    private function normalizeName(string $name): string
    {
        return trim(preg_replace('/\s+/', ' ', $name) ?? '');
    }
};
