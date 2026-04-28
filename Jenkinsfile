pipeline {
    agent any

    environment {
        // Multiple Docker Images (Hybrid Architecture)
        BACKEND_IMAGE   = "shahd/recruitment-backend"
        AI_IMAGE        = "shahd/recruitment-ai"
        AI_WORKER_IMAGE = "shahd/recruitment-ai-worker"
        AI_BEAT_IMAGE   = "shahd/recruitment-ai-beat"
        ADMIN_IMAGE     = "shahd/recruitment-admin"
        
        // Deployment Configuration
        DEPLOY_USER     = "shahd"
        DEPLOY_HOST     = "10.0.2.20"
        APP_DIR         = "/home/shahd/recruitment"
    }

    stages {

        // =====================================================================
        // STAGE 1: Clone Source
        // =====================================================================
        stage('Clone Source') {
            steps {
                cleanWs()
                git branch: 'main',
                    url: 'https://github.com/shhahdddddd/AI-recrutement',
                    credentialsId: 'github-creds'
                
                script {
                    env.TAG = env.BUILD_NUMBER
                    echo "Building tag: ${TAG}"
                }
            }
        }

        // =====================================================================
        // STAGE 2: Build Backend Image (Laravel)
        // =====================================================================
        stage('Build Backend') {
            steps {
                sh """
                    echo "Building Laravel Backend..."
                    docker build -t ${BACKEND_IMAGE}:${TAG} -f backend/Dockerfile backend/
                    docker tag ${BACKEND_IMAGE}:${TAG} ${BACKEND_IMAGE}:latest
                """
            }
        }

        // =====================================================================
        // STAGE 3: Build AI Images (Parallel)
        // =====================================================================
        stage('Build AI Services') {
            parallel {
                stage('AI API') {
                    steps {
                        sh """
                            echo "Building AI API..."
                            docker build -t ${AI_IMAGE}:${TAG} -f ai/Dockerfile ai/
                            docker tag ${AI_IMAGE}:${TAG} ${AI_IMAGE}:latest
                        """
                    }
                }
                stage('AI Worker') {
                    steps {
                        sh """
                            echo "Building AI Worker..."
                            docker build -t ${AI_WORKER_IMAGE}:${TAG} -f ai/Dockerfile.worker ai/
                            docker tag ${AI_WORKER_IMAGE}:${TAG} ${AI_WORKER_IMAGE}:latest
                        """
                    }
                }
                stage('AI Beat') {
                    steps {
                        sh """
                            echo "Building AI Scheduler..."
                            docker build -t ${AI_BEAT_IMAGE}:${TAG} -f ai/Dockerfile.beat ai/
                            docker tag ${AI_BEAT_IMAGE}:${TAG} ${AI_BEAT_IMAGE}:latest
                        """
                    }
                }
            }
        }

        // =====================================================================
        // STAGE 4: Build Admin Panel
        // =====================================================================
        stage('Build Admin') {
            steps {
                sh """
                    echo "Building Angular Admin Panel..."
                    docker build -t ${ADMIN_IMAGE}:${TAG} -f admin/Dockerfile admin/
                    docker tag ${ADMIN_IMAGE}:${TAG} ${ADMIN_IMAGE}:latest
                """
            }
        }

        // =====================================================================
        // STAGE 5: Transfer All Images to Server
        // =====================================================================
        stage('Transfer Images') {
            steps {
                sshagent(['deploy-key']) {
                    sh """
                        echo "Transferring Backend image..."
                        docker save ${BACKEND_IMAGE}:${TAG} | gzip | ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'gunzip | docker load'
                        
                        echo "Transferring AI API image..."
                        docker save ${AI_IMAGE}:${TAG} | gzip | ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'gunzip | docker load'
                        
                        echo "Transferring AI Worker image..."
                        docker save ${AI_WORKER_IMAGE}:${TAG} | gzip | ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'gunzip | docker load'
                        
                        echo "Transferring AI Beat image..."
                        docker save ${AI_BEAT_IMAGE}:${TAG} | gzip | ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'gunzip | docker load'
                        
                        echo "Transferring Admin image..."
                        docker save ${ADMIN_IMAGE}:${TAG} | gzip | ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} 'gunzip | docker load'
                    """
                }
            }
        }

        // =====================================================================
        // STAGE 6: Deploy to Production
        // =====================================================================
        stage('Deploy') {
            steps {
                sshagent(['deploy-key']) {
                    sh """
                        # Sync configuration files
                        rsync -avz --delete \
                            --exclude='.git' \
                            --exclude='vendor' \
                            --exclude='node_modules' \
                            --exclude='ai/env' \
                            --exclude='frontend' \
                            ./docker-compose.yml \
                            ./.env.docker \
                            ./nginx/ \
                            ./backend/ \
                            ./ai/ \
                            ./admin/ \
                            ${DEPLOY_USER}@${DEPLOY_HOST}:${APP_DIR}/

                        # Execute remote deployment
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} '
                            set -e
                            cd ${APP_DIR}
                            
                            echo "TAG=${TAG}" > .env
                            echo "GIT_COMMIT=${GIT_COMMIT}" >> .env
                            
                            # Create required directories
                            mkdir -p backend/storage/framework/{cache,views,sessions}
                            mkdir -p backend/storage/logs
                            mkdir -p backend/bootstrap/cache
                            mkdir -p ai/media ai/kb_documents
                            
                            chmod -R 775 backend/storage backend/bootstrap/cache
                            
                            # Pull infrastructure images
                            docker-compose pull postgres redis chromadb keycloak nginx
                            
                            # Start infrastructure first
                            echo "Starting infrastructure..."
                            docker-compose up -d postgres redis chromadb keycloak
                            sleep 15
                            
                            # Start applications
                            echo "Starting applications..."
                            docker-compose up -d backend backend_worker backend_scheduler
                            docker-compose up -d ai ai_worker ai_beat
                            docker-compose up -d admin nginx
                            
                            sleep 20
                            
                            # Run migrations
                            docker-compose exec -T backend php artisan migrate --force || true
                            docker-compose exec -T ai python manage.py migrate || true
                            
                            # Clear caches
                            docker-compose exec -T backend php artisan config:clear || true
                            docker-compose exec -T backend php artisan cache:clear || true
                            docker-compose exec -T backend php artisan view:clear || true
                            
                            # Restart queue workers
                            docker-compose exec -T backend php artisan queue:restart || true
                            
                            # Cleanup old images
                            docker image prune -af --filter "until=168h" || true
                            
                            echo "Deployment complete!"
                        '
                    """
                }
            }
        }

        // =====================================================================
        // STAGE 7: Health Checks
        // =====================================================================
        stage('Health Check') {
            steps {
                sh """
                    echo "Checking Backend..."
                    curl -f http://${DEPLOY_HOST}:8000 || echo "Backend check failed"
                    
                    echo "Checking AI Service..."
                    curl -f http://${DEPLOY_HOST}:8002/health/ || echo "AI check failed"
                    
                    echo "Checking Admin Panel..."
                    curl -f http://${DEPLOY_HOST}:4200 || echo "Admin check failed"
                    
                    echo "Checking Nginx..."
                    curl -f http://${DEPLOY_HOST}:80 || echo "Nginx check failed"
                """
            }
        }
    }

    post {
        success {
            echo '✅ Deployment Success'
        }
        failure {
            echo '❌ Deployment Failed'
        }
    }
}
