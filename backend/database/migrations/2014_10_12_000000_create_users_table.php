<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::unprepared("
            -- Cleanup existing types if they exist
            DROP TYPE IF EXISTS notification_status CASCADE;
            DROP TYPE IF EXISTS notification_channel CASCADE;
            DROP TYPE IF EXISTS meeting_status CASCADE;
            DROP TYPE IF EXISTS contract_type_enum CASCADE;
            DROP TYPE IF EXISTS matching_status CASCADE;
            DROP TYPE IF EXISTS application_status CASCADE;
            DROP TYPE IF EXISTS offer_type CASCADE;
            DROP TYPE IF EXISTS job_status CASCADE;
            DROP TYPE IF EXISTS question_type CASCADE;
            DROP TYPE IF EXISTS quiz_difficulty CASCADE;
            DROP TYPE IF EXISTS skill_level CASCADE;

            -- 1️⃣ ENUM TYPES
            CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced');
            CREATE TYPE quiz_difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD');
            CREATE TYPE question_type AS ENUM ('QCM', 'SCENARIO');
            CREATE TYPE job_status AS ENUM ('open', 'closed', 'filled');
            CREATE TYPE offer_type AS ENUM ('fulltime', 'parttime', 'freelance', 'internship');
            CREATE TYPE application_status AS ENUM ('pending', 'accepted', 'rejected', 'viewed');
            CREATE TYPE matching_status AS ENUM ('recommended', 'applied', 'rejected', 'hired');
            CREATE TYPE contract_type_enum AS ENUM ('CVP','CID','CDD','ALTERNANCE');
            CREATE TYPE meeting_status AS ENUM ('pending', 'confirmed', 'completed', 'canceled');
            CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push');
            CREATE TYPE notification_status AS ENUM ('sent', 'pending', 'failed');

            -- 2️⃣ USERS & ACTORS
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('candidate', 'recruiter', 'client')),
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            );

            CREATE TABLE admins (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            );

            CREATE TABLE industries (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_by INT REFERENCES admins(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE specialties (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                category VARCHAR(100),
                created_by INT REFERENCES admins(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE candidates (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                picture VARCHAR(255),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                phone VARCHAR(50),
                location VARCHAR(255),
                specialty_id INT REFERENCES specialties(id),
                still_student BOOLEAN DEFAULT FALSE,
                cycle_eng BOOLEAN DEFAULT FALSE,
                bio TEXT,
                cv_path VARCHAR(255),
                initial_profile_score FLOAT,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE companies (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                picture VARCHAR(255),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                industry_id INT REFERENCES industries(id),
                location VARCHAR(255),
                international BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE clients (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                picture VARCHAR(255),
                full_name VARCHAR(255),
                phone VARCHAR(50),
                business_owner BOOLEAN DEFAULT FALSE,
                location VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- 3️⃣ SKILLS & CVS
            CREATE TABLE skills (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                category VARCHAR(100),
                created_by INT REFERENCES admins(id)
            );

            CREATE TABLE candidate_skills (
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
                level skill_level NOT NULL,
                cv_score FLOAT CHECK (cv_score >= 0 AND cv_score <= 100),
                test_score FLOAT CHECK (test_score >= 0 AND test_score <= 100),
                final_score FLOAT CHECK (final_score >= 0 AND final_score <= 100),
                updated_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY(candidate_id, skill_id)
            );

            CREATE TABLE cv_files (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                file_path VARCHAR(255) NOT NULL,
                parsed BOOLEAN DEFAULT FALSE,
                uploaded_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE cv_parsed_data (
                id SERIAL PRIMARY KEY,
                cv_id INT REFERENCES cv_files(id) ON DELETE CASCADE,
                extracted_skills JSONB,
                extracted_experience JSONB,
                education TEXT,
                raw_text TEXT
            );

            -- 4️⃣ JOB OFFERS & REQUIREMENTS
            CREATE TABLE job_offers (
                id SERIAL PRIMARY KEY,
                company_id INT REFERENCES companies(id) ON DELETE SET NULL,
                client_id INT REFERENCES clients(id) ON DELETE SET NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                date_posted DATE DEFAULT CURRENT_DATE,
                location VARCHAR(255),
                status job_status DEFAULT 'open',
                offer_type offer_type NOT NULL,
                budget FLOAT,
                contract_type_detail contract_type_enum,
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT chk_job_owner CHECK (
                    (company_id IS NOT NULL AND client_id IS NULL) OR 
                    (company_id IS NULL AND client_id IS NOT NULL)
                )
            );

            CREATE TABLE job_requirements (
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
                weight FLOAT CHECK (weight > 0),
                minimum_level skill_level,
                cycle_eng BOOLEAN,
                PRIMARY KEY(job_offer_id, skill_id)
            );

            CREATE TABLE internship_requirements (
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
                minimum_level skill_level,
                cycle_eng BOOLEAN,
                duration_months INT CHECK (duration_months > 0),
                start_date DATE,
                PRIMARY KEY(job_offer_id, skill_id)
            );

            CREATE TABLE freelance_requirements (
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
                minimum_level skill_level,
                estimated_hours INT CHECK (estimated_hours > 0),
                deadline DATE,
                remote_allowed BOOLEAN DEFAULT FALSE,
                budget_min FLOAT CHECK (budget_min >= 0),
                budget_max FLOAT CHECK (budget_max >= budget_min),
                PRIMARY KEY(job_offer_id, skill_id)
            );

            -- 5️⃣ QUIZZES & EVALUATION
            CREATE TABLE quizzes (
                id SERIAL PRIMARY KEY,
                skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
                difficulty quiz_difficulty NOT NULL
            );

            CREATE TABLE questions (
                id SERIAL PRIMARY KEY,
                quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                question_type question_type NOT NULL
            );

            CREATE TABLE answers (
                id SERIAL PRIMARY KEY,
                question_id INT REFERENCES questions(id) ON DELETE CASCADE,
                answer_text TEXT NOT NULL,
                is_correct BOOLEAN NOT NULL
            );

            CREATE TABLE test_sessions (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
                attempt_number INT DEFAULT 1,
                final_score FLOAT CHECK (final_score >= 0 AND final_score <= 100),
                feedback_ia JSONB,
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP,
                UNIQUE(candidate_id, quiz_id, attempt_number)
            );

            -- 6️⃣ MATCHING & APPLICATIONS
            CREATE TABLE matchings (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                compatibility_score FLOAT CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
                ai_confidence FLOAT,
                explanation JSONB,
                status matching_status DEFAULT 'recommended',
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(candidate_id, job_offer_id)
            );

            CREATE TABLE applications (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                applied_at TIMESTAMP DEFAULT NOW(),
                status application_status DEFAULT 'pending'
            );

            CREATE TABLE freelance_bids (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                proposed_price FLOAT CHECK (proposed_price >= 0),
                message TEXT,
                status application_status DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(candidate_id, job_offer_id)
            );

            -- 7️⃣ MEETINGS & NOTIFICATIONS
            CREATE TABLE interviews (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                recruiter_id INT REFERENCES companies(id) ON DELETE CASCADE,
                scheduled_at TIMESTAMP NOT NULL,
                duration_minutes INT,
                location VARCHAR(255),
                status meeting_status DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                notes TEXT
            );

            CREATE TABLE client_meetings (
                id SERIAL PRIMARY KEY,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                client_id INT REFERENCES clients(id) ON DELETE CASCADE,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                scheduled_at TIMESTAMP NOT NULL,
                duration_minutes INT,
                location VARCHAR(255),
                status meeting_status DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                notes TEXT
            );

            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                reference_id INT NOT NULL,
                channel notification_channel,
                message TEXT,
                sent_at TIMESTAMP,
                status notification_status DEFAULT 'sent'
            );

            -- 8️⃣ CONTRACTS
            CREATE TABLE signed_contracts (
                id SERIAL PRIMARY KEY,
                job_offer_id INT REFERENCES job_offers(id) ON DELETE CASCADE,
                candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
                contract_type contract_type_enum NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                salary FLOAT CHECK (salary >= 0),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT dates_valid CHECK (end_date IS NULL OR end_date > start_date)
            );

            -- 9️⃣ INDEXES (Performance)
            CREATE INDEX idx_users_email ON users(email);
            CREATE INDEX idx_candidates_location ON candidates(location);
            CREATE INDEX idx_job_offers_status ON job_offers(status);
            CREATE INDEX idx_job_offers_type ON job_offers(offer_type);
            CREATE INDEX idx_matchings_score ON matchings(compatibility_score);
            CREATE INDEX idx_matchings_offer ON matchings(job_offer_id);
            CREATE INDEX idx_applications_status ON applications(status);
            CREATE INDEX idx_notifications_user ON notifications(user_id);
            CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
            CREATE INDEX idx_interviews_recruiter ON interviews(recruiter_id);
            CREATE INDEX idx_client_meetings_candidate ON client_meetings(candidate_id);
            CREATE INDEX idx_client_meetings_client ON client_meetings(client_id);
        ");
    }

    public function down()
    {
        DB::unprepared("
            DROP TABLE IF EXISTS signed_contracts CASCADE;
            DROP TABLE IF EXISTS notifications CASCADE;
            DROP TABLE IF EXISTS client_meetings CASCADE;
            DROP TABLE IF EXISTS interviews CASCADE;
            DROP TABLE IF EXISTS freelance_bids CASCADE;
            DROP TABLE IF EXISTS applications CASCADE;
            DROP TABLE IF EXISTS matchings CASCADE;
            DROP TABLE IF EXISTS test_sessions CASCADE;
            DROP TABLE IF EXISTS answers CASCADE;
            DROP TABLE IF EXISTS questions CASCADE;
            DROP TABLE IF EXISTS quizzes CASCADE;
            DROP TABLE IF EXISTS freelance_requirements CASCADE;
            DROP TABLE IF EXISTS internship_requirements CASCADE;
            DROP TABLE IF EXISTS job_requirements CASCADE;
            DROP TABLE IF EXISTS job_offers CASCADE;
            DROP TABLE IF EXISTS cv_parsed_data CASCADE;
            DROP TABLE IF EXISTS cv_files CASCADE;
            DROP TABLE IF EXISTS candidate_skills CASCADE;
            DROP TABLE IF EXISTS skills CASCADE;
            DROP TABLE IF EXISTS clients CASCADE;
            DROP TABLE IF EXISTS companies CASCADE;
            DROP TABLE IF EXISTS candidates CASCADE;
            DROP TABLE IF EXISTS specialties CASCADE;
            DROP TABLE IF EXISTS industries CASCADE;
            DROP TABLE IF EXISTS admins CASCADE;
            DROP TABLE IF EXISTS users CASCADE;

            DROP TYPE IF EXISTS notification_status CASCADE;
            DROP TYPE IF EXISTS notification_channel CASCADE;
            DROP TYPE IF EXISTS meeting_status CASCADE;
            DROP TYPE IF EXISTS contract_type_enum CASCADE;
            DROP TYPE IF EXISTS matching_status CASCADE;
            DROP TYPE IF EXISTS application_status CASCADE;
            DROP TYPE IF EXISTS offer_type CASCADE;
            DROP TYPE IF EXISTS job_status CASCADE;
            DROP TYPE IF EXISTS question_type CASCADE;
            DROP TYPE IF EXISTS quiz_difficulty CASCADE;
            DROP TYPE IF EXISTS skill_level CASCADE;
        ");
    }
};
